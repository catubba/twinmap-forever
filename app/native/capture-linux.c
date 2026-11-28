#define _GNU_SOURCE 1
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/file.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#include <gio/gio.h>
#include <gio/gunixfdlist.h>
#include <pipewire/pipewire.h>
#include <spa/buffer/meta.h>
#include <spa/param/param.h>
#include <spa/param/video/format-utils.h>
#include <spa/pod/builder.h>

#include "convert.h"

_Static_assert(__BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__, "le");

enum { HEADER_BYTES = 24, TOP_ROWS = 129, SNAPSHOT_MS = 200, MAX_SIDE = 16384 };
enum { LOCK_FD = 3, MAX_TOKEN = 512 };

#define PORTAL_NAME "org.freedesktop.portal.Desktop"
#define PORTAL_PATH "/org/freedesktop/portal/desktop"
#define SCREENCAST "org.freedesktop.portal.ScreenCast"

struct layout { int width, height, top_rows; size_t top, bottom, left, right, snapshot, length; };

struct app {
    GMainLoop *loop;
    GDBusConnection *bus;
    int exit_code;
    bool first_line_seen;
    char *restore_token;
    uint32_t session_number;
    int frame_fd;
    unsigned counter;
    guint32 cursor_modes;
    char *request;
    guint response_sub;
    char *session;
    char *expected_session;
    guint closed_sub;

    struct pw_thread_loop *pw_loop;
    struct pw_context *pw_context;
    struct pw_core *pw_core;
    struct pw_stream *stream;
    struct spa_hook stream_listener;
    bool have_format;
    enum tm_format format;
    int format_width, format_height;
    bool streaming, got_buffer;

    struct layout layout;
    bool have_layout, relayout_pending, force_snapshot;
    uint8_t *map;
    size_t map_length;
    uint32_t frames;
    uint64_t last_snapshot_ms;

    atomic_flag terminal;
    atomic_bool stopping;
};

static bool layout_for(int width, int height, struct layout *out) {
    if (width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) return false;
    size_t w = (size_t)width, h = (size_t)height;
    out->width = width;
    out->height = height;
    out->top_rows = height < TOP_ROWS ? height : TOP_ROWS;
    out->top = HEADER_BYTES;
    out->bottom = out->top + (size_t)out->top_rows * w * 4;
    out->left = out->bottom + w * 4;
    out->right = out->left + h * 4;
    out->snapshot = out->right + h * 4;
    out->length = out->snapshot + h * w * 4;
    return true;
}

static void json_put_string(FILE *out, const char *s) {
    fputc('"', out);
    for (const unsigned char *p = (const unsigned char *)s; *p; p++) {
        if (*p == '"' || *p == '\\') fprintf(out, "\\%c", *p);
        else if (*p < 0x20 || *p == 0x7f) fprintf(out, "\\u%04x", *p);
        else fputc(*p, out);
    }
    fputc('"', out);
}

static void say_layout(const struct layout *l) {
    flockfile(stdout);
    printf("{\"layout\":{\"width\":%d,\"height\":%d,\"topRows\":%d}}\n", l->width, l->height, l->top_rows);
    funlockfile(stdout);
}

static bool valid_token(const char *s) {
    size_t n = strlen(s);
    if (n < 1 || n > MAX_TOKEN) return false;
    for (size_t i = 0; i < n; i++)
        if ((unsigned char)s[i] < 0x21 || (unsigned char)s[i] > 0x7e) return false;
    return true;
}

static void say_token(const char *token_or_null) {
    flockfile(stdout);
    if (token_or_null) {
        fputs("{\"token\":", stdout);
        json_put_string(stdout, token_or_null);
        fputs("}\n", stdout);
    } else {
        fputs("{\"token\":null}\n", stdout);
    }
    funlockfile(stdout);
}

static void say_state(struct app *a, const char *state, const char *why) {
    if (atomic_flag_test_and_set(&a->terminal)) return;
    atomic_store(&a->stopping, true);
    flockfile(stdout);
    fputs("{\"state\":", stdout);
    json_put_string(stdout, state);
    if (why) {
        fputs(",\"why\":", stdout);
        json_put_string(stdout, why);
    }
    fputs("}\n", stdout);
    funlockfile(stdout);
    g_main_loop_quit(a->loop);
}

static uint64_t now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000u + (uint64_t)ts.tv_nsec / 1000000u;
}

static bool parse_first_line(const char *line, char **token_out) {
    static const char prefix[] = "{\"token\":\"";
    *token_out = NULL;
    if (strcmp(line, "{}") == 0) return true;
    size_t n = strlen(line);
    if (n < sizeof prefix - 1 + 2 || strncmp(line, prefix, sizeof prefix - 1) != 0 || strcmp(line + n - 2, "\"}") != 0) return false;
    const char *p = line + sizeof prefix - 1, *end = line + n - 2;
    char *token = g_malloc(n);
    size_t len = 0;
    while (p < end) {
        char c = *p++;
        if (c == '"') goto bad;
        if (c == '\\') {
            if (p >= end || (*p != '"' && *p != '\\')) goto bad;
            c = *p++;
        }
        token[len++] = c;
    }
    token[len] = 0;
    if (!valid_token(token)) goto bad;
    *token_out = token;
    return true;
bad:
    g_free(token);
    return false;
}

static char *sender_part(GDBusConnection *c) {
    const char *unique = g_dbus_connection_get_unique_name(c);
    char *s = g_strdup(unique[0] == ':' ? unique + 1 : unique);
    for (char *p = s; *p; p++) if (*p == '.') *p = '_';
    return s;
}

static char *request_path(GDBusConnection *c, const char *token) {
    g_autofree char *sender = sender_part(c);
    return g_strdup_printf(PORTAL_PATH "/request/%s/%s", sender, token);
}

static char *session_path(GDBusConnection *c, const char *token) {
    g_autofree char *sender = sender_part(c);
    return g_strdup_printf(PORTAL_PATH "/session/%s/%s", sender, token);
}

static char *new_token(struct app *a) {
    return g_strdup_printf("twinmap_%d_%u", (int)getpid(), ++a->counter);
}

static guint watch_response(struct app *a, const char *path, GDBusSignalCallback cb) {
    return g_dbus_connection_signal_subscribe(a->bus, PORTAL_NAME, "org.freedesktop.portal.Request", "Response",
                                              path, NULL, G_DBUS_SIGNAL_FLAGS_NONE, cb, a, NULL);
}

static void unwatch_request(struct app *a) {
    if (a->response_sub) g_dbus_connection_signal_unsubscribe(a->bus, a->response_sub);
    a->response_sub = 0;
    g_clear_pointer(&a->request, g_free);
}

static bool portal_request(struct app *a, const char *method, GVariant *params, const char *token, GDBusSignalCallback cb) {
    a->request = request_path(a->bus, token);
    a->response_sub = watch_response(a, a->request, cb);
    g_autoptr(GError) err = NULL;
    g_autoptr(GVariant) reply = g_dbus_connection_call_sync(a->bus, PORTAL_NAME, PORTAL_PATH, SCREENCAST, method, params,
                                                            G_VARIANT_TYPE("(o)"), G_DBUS_CALL_FLAGS_NONE, -1, NULL, &err);
    if (!reply) {
        fprintf(stderr, "twinmap-capture: %s failed: %s\n", method, err->message);
        unwatch_request(a);
        say_state(a, "refused", err->message);
        return false;
    }
    const char *handle = NULL;
    g_variant_get(reply, "(&o)", &handle);
    if (strcmp(handle, a->request) != 0) {
        g_dbus_connection_signal_unsubscribe(a->bus, a->response_sub);
        g_free(a->request);
        a->request = g_strdup(handle);
        a->response_sub = watch_response(a, a->request, cb);
    }
    return true;
}

static void portal_register(struct app *a) {
    GVariantBuilder options;
    g_variant_builder_init(&options, G_VARIANT_TYPE_VARDICT);
    g_autoptr(GError) err = NULL;
    g_autoptr(GVariant) reply = g_dbus_connection_call_sync(a->bus, PORTAL_NAME, PORTAL_PATH, "org.freedesktop.host.portal.Registry", "Register",
                                                            g_variant_new("(sa{sv})", "app.twinmap", &options), NULL,
                                                            G_DBUS_CALL_FLAGS_NONE, -1, NULL, &err);
    if (!reply) fprintf(stderr, "twinmap-capture: Registry.Register failed: %s\n", err->message);
}

static bool portal_uint_property(struct app *a, const char *name, guint32 *out) {
    g_autoptr(GError) err = NULL;
    g_autoptr(GVariant) reply = g_dbus_connection_call_sync(a->bus, PORTAL_NAME, PORTAL_PATH, "org.freedesktop.DBus.Properties", "Get",
                                                            g_variant_new("(ss)", SCREENCAST, name), G_VARIANT_TYPE("(v)"),
                                                            G_DBUS_CALL_FLAGS_NONE, -1, NULL, &err);
    if (!reply) {
        fprintf(stderr, "twinmap-capture: ScreenCast %s: %s\n", name, err->message);
        return false;
    }
    g_autoptr(GVariant) value = NULL;
    g_variant_get(reply, "(v)", &value);
    if (!g_variant_is_of_type(value, G_VARIANT_TYPE_UINT32)) return false;
    *out = g_variant_get_uint32(value);
    return true;
}

static bool response_ok(struct app *a, GVariant *params, GVariant **results) {
    guint32 code = 2;
    *results = NULL;
    if (g_variant_is_of_type(params, G_VARIANT_TYPE("(ua{sv})"))) g_variant_get(params, "(u@a{sv})", &code, results);
    unwatch_request(a);
    if (code == 0 && *results) return true;
    g_clear_pointer(results, g_variant_unref);
    say_state(a, code == 1 ? "cancelled" : "refused", NULL);
    return false;
}

static void on_session_closed(GDBusConnection *c, const gchar *sender, const gchar *path, const gchar *iface,
                              const gchar *signal, GVariant *params, gpointer data) {
    (void)c; (void)sender; (void)path; (void)iface; (void)signal; (void)params;
    struct app *a = data;
    g_clear_pointer(&a->session, g_free);
    say_state(a, "closed", NULL);
}

static bool pw_start(struct app *a, int fd, guint32 node_id, guint64 serial, bool has_serial);

static int portal_open_remote(struct app *a) {
    GVariantBuilder options;
    g_variant_builder_init(&options, G_VARIANT_TYPE_VARDICT);
    g_autoptr(GError) err = NULL;
    g_autoptr(GUnixFDList) fds = NULL;
    g_autoptr(GVariant) reply = g_dbus_connection_call_with_unix_fd_list_sync(a->bus, PORTAL_NAME, PORTAL_PATH, SCREENCAST, "OpenPipeWireRemote",
                                                                              g_variant_new("(oa{sv})", a->session, &options), G_VARIANT_TYPE("(h)"),
                                                                              G_DBUS_CALL_FLAGS_NONE, -1, NULL, &fds, NULL, &err);
    if (!reply) {
        fprintf(stderr, "twinmap-capture: OpenPipeWireRemote failed: %s\n", err->message);
        say_state(a, "refused", err->message);
        return -1;
    }
    gint32 index = -1;
    g_variant_get(reply, "(h)", &index);
    int fd = fds ? g_unix_fd_list_get(fds, index, &err) : -1;
    if (fd < 0) {
        const char *why = err ? err->message : "no PipeWire descriptor";
        fprintf(stderr, "twinmap-capture: OpenPipeWireRemote: %s\n", why);
        say_state(a, "refused", why);
    }
    return fd;
}

static void on_start_response(GDBusConnection *c, const gchar *sender, const gchar *path, const gchar *iface,
                              const gchar *signal, GVariant *params, gpointer data) {
    (void)c; (void)sender; (void)path; (void)iface; (void)signal;
    struct app *a = data;
    g_autoptr(GVariant) results = NULL;
    if (!response_ok(a, params, &results)) return;
    const char *token = NULL;
    if (g_variant_lookup(results, "restore_token", "&s", &token) && !valid_token(token)) {
        fprintf(stderr, "twinmap-capture: ignoring a malformed restore token\n");
        token = NULL;
    }
    say_token(token);
    g_autoptr(GVariant) streams = g_variant_lookup_value(results, "streams", G_VARIANT_TYPE("a(ua{sv})"));
    if (!streams || g_variant_n_children(streams) < 1) {
        say_state(a, "refused", "no stream");
        return;
    }
    guint32 node_id = 0;
    g_autoptr(GVariant) props = NULL;
    g_variant_get_child(streams, 0, "(u@a{sv})", &node_id, &props);
    guint64 serial = 0;
    bool has_serial = g_variant_lookup(props, "pipewire-serial", "t", &serial);
    int fd = portal_open_remote(a);
    if (fd < 0) return;
    pw_start(a, fd, node_id, serial, has_serial);
}

static void portal_start(struct app *a) {
    g_autofree char *token = new_token(a);
    GVariantBuilder options;
    g_variant_builder_init(&options, G_VARIANT_TYPE_VARDICT);
    g_variant_builder_add(&options, "{sv}", "handle_token", g_variant_new_string(token));
    portal_request(a, "Start", g_variant_new("(osa{sv})", a->session, "", &options), token, on_start_response);
}

static void on_select_response(GDBusConnection *c, const gchar *sender, const gchar *path, const gchar *iface,
                               const gchar *signal, GVariant *params, gpointer data) {
    (void)c; (void)sender; (void)path; (void)iface; (void)signal;
    struct app *a = data;
    g_autoptr(GVariant) results = NULL;
    if (response_ok(a, params, &results)) portal_start(a);
}

static void portal_select_sources(struct app *a) {
    g_autofree char *token = new_token(a);
    GVariantBuilder options;
    g_variant_builder_init(&options, G_VARIANT_TYPE_VARDICT);
    g_variant_builder_add(&options, "{sv}", "handle_token", g_variant_new_string(token));
    g_variant_builder_add(&options, "{sv}", "types", g_variant_new_uint32(2));
    g_variant_builder_add(&options, "{sv}", "multiple", g_variant_new_boolean(FALSE));
    g_variant_builder_add(&options, "{sv}", "persist_mode", g_variant_new_uint32(2));
    if (a->cursor_modes & 1) g_variant_builder_add(&options, "{sv}", "cursor_mode", g_variant_new_uint32(1));
    else if (a->cursor_modes & 4) g_variant_builder_add(&options, "{sv}", "cursor_mode", g_variant_new_uint32(4));
    if (a->restore_token) g_variant_builder_add(&options, "{sv}", "restore_token", g_variant_new_string(a->restore_token));
    portal_request(a, "SelectSources", g_variant_new("(oa{sv})", a->session, &options), token, on_select_response);
}

static void on_create_response(GDBusConnection *c, const gchar *sender, const gchar *path, const gchar *iface,
                               const gchar *signal, GVariant *params, gpointer data) {
    (void)c; (void)sender; (void)path; (void)iface; (void)signal;
    struct app *a = data;
    g_autoptr(GVariant) results = NULL;
    if (!response_ok(a, params, &results)) return;
    g_autoptr(GVariant) handle = g_variant_lookup_value(results, "session_handle", NULL);
    if (handle && (g_variant_is_of_type(handle, G_VARIANT_TYPE_STRING) || g_variant_is_of_type(handle, G_VARIANT_TYPE_OBJECT_PATH)))
        a->session = g_strdup(g_variant_get_string(handle, NULL));
    else
        a->session = g_strdup(a->expected_session);
    if (!a->session || !g_variant_is_object_path(a->session)) {
        g_clear_pointer(&a->session, g_free);
        say_state(a, "refused", "no session handle");
        return;
    }
    a->closed_sub = g_dbus_connection_signal_subscribe(a->bus, PORTAL_NAME, "org.freedesktop.portal.Session", "Closed",
                                                       a->session, NULL, G_DBUS_SIGNAL_FLAGS_NONE, on_session_closed, a, NULL);
    portal_select_sources(a);
}

static void portal_create_session(struct app *a) {
    g_autofree char *token = new_token(a);
    g_autofree char *session_token = new_token(a);
    a->expected_session = session_path(a->bus, session_token);
    GVariantBuilder options;
    g_variant_builder_init(&options, G_VARIANT_TYPE_VARDICT);
    g_variant_builder_add(&options, "{sv}", "handle_token", g_variant_new_string(token));
    g_variant_builder_add(&options, "{sv}", "session_handle_token", g_variant_new_string(session_token));
    portal_request(a, "CreateSession", g_variant_new("(a{sv})", &options), token, on_create_response);
}

static void portal_begin(struct app *a) {
    g_autoptr(GError) err = NULL;
    a->bus = g_bus_get_sync(G_BUS_TYPE_SESSION, NULL, &err);
    if (!a->bus) {
        say_state(a, "unsupported", err->message);
        return;
    }
    portal_register(a);
    guint32 version = 0, sources = 0;
    if (!portal_uint_property(a, "version", &version) || !portal_uint_property(a, "AvailableSourceTypes", &sources)) {
        say_state(a, "unsupported", "no ScreenCast portal");
        return;
    }
    if (version < 4) {
        say_state(a, "unsupported", "ScreenCast portal older than version 4");
        return;
    }
    if (!(sources & 2)) {
        say_state(a, "unsupported", "ScreenCast portal cannot capture windows");
        return;
    }
    if (!portal_uint_property(a, "AvailableCursorModes", &a->cursor_modes)) a->cursor_modes = 0;
    portal_create_session(a);
}

static void portal_close(struct app *a) {
    if (!a->bus) return;
    if (a->request) {
        g_autoptr(GVariant) r = g_dbus_connection_call_sync(a->bus, PORTAL_NAME, a->request, "org.freedesktop.portal.Request", "Close",
                                                            NULL, NULL, G_DBUS_CALL_FLAGS_NONE, 2000, NULL, NULL);
    }
    unwatch_request(a);
    if (a->closed_sub) g_dbus_connection_signal_unsubscribe(a->bus, a->closed_sub);
    a->closed_sub = 0;
    if (a->session) {
        g_autoptr(GVariant) r = g_dbus_connection_call_sync(a->bus, PORTAL_NAME, a->session, "org.freedesktop.portal.Session", "Close",
                                                            NULL, NULL, G_DBUS_CALL_FLAGS_NONE, 2000, NULL, NULL);
    }
    g_clear_pointer(&a->session, g_free);
}

static gboolean on_stdin(GIOChannel *ch, GIOCondition cond, gpointer data) {
    (void)cond;
    struct app *a = data;
    for (;;) {
        char *line = NULL;
        gsize length = 0, terminator = 0;
        GIOStatus status = g_io_channel_read_line(ch, &line, &length, &terminator, NULL);
        if (status == G_IO_STATUS_AGAIN) return TRUE;
        if (status != G_IO_STATUS_NORMAL) {
            g_free(line);
            atomic_flag_test_and_set(&a->terminal);
            atomic_store(&a->stopping, true);
            g_main_loop_quit(a->loop);
            return FALSE;
        }
        if (a->first_line_seen) {
            g_free(line);
            continue;
        }
        a->first_line_seen = true;
        line[terminator] = 0;
        bool ok = strlen(line) == terminator && parse_first_line(line, &a->restore_token);
        g_free(line);
        if (!ok) {
            fprintf(stderr, "twinmap-capture: the first stdin line must be {} or {\"token\":\"...\"}\n");
            a->exit_code = 2;
            atomic_flag_test_and_set(&a->terminal);
            g_main_loop_quit(a->loop);
            return FALSE;
        }
        portal_begin(a);
    }
}

static bool tm_format_of(uint32_t spa_format, enum tm_format *out) {
    switch (spa_format) {
    case SPA_VIDEO_FORMAT_BGRx: *out = TM_BGRX; return true;
    case SPA_VIDEO_FORMAT_BGRA: *out = TM_BGRA; return true;
    case SPA_VIDEO_FORMAT_RGBx: *out = TM_RGBX; return true;
    case SPA_VIDEO_FORMAT_RGBA: *out = TM_RGBA; return true;
    case SPA_VIDEO_FORMAT_xRGB: *out = TM_XRGB; return true;
    case SPA_VIDEO_FORMAT_xBGR: *out = TM_XBGR; return true;
    case SPA_VIDEO_FORMAT_ARGB: *out = TM_ARGB; return true;
    case SPA_VIDEO_FORMAT_ABGR: *out = TM_ABGR; return true;
    case SPA_VIDEO_FORMAT_BGR: *out = TM_BGR; return true;
    case SPA_VIDEO_FORMAT_RGB: *out = TM_RGB; return true;
    case SPA_VIDEO_FORMAT_xRGB_210LE: *out = TM_XRGB_210LE; return true;
    case SPA_VIDEO_FORMAT_xBGR_210LE: *out = TM_XBGR_210LE; return true;
    case SPA_VIDEO_FORMAT_RGBx_102LE: *out = TM_RGBX_102LE; return true;
    case SPA_VIDEO_FORMAT_BGRx_102LE: *out = TM_BGRX_102LE; return true;
    default: return false;
    }
}

static const struct spa_pod *enum_format(struct spa_pod_builder *b) {
    return spa_pod_builder_add_object(b, SPA_TYPE_OBJECT_Format, SPA_PARAM_EnumFormat,
        SPA_FORMAT_mediaType, SPA_POD_Id(SPA_MEDIA_TYPE_video),
        SPA_FORMAT_mediaSubtype, SPA_POD_Id(SPA_MEDIA_SUBTYPE_raw),
        SPA_FORMAT_VIDEO_format, SPA_POD_CHOICE_ENUM_Id(15, SPA_VIDEO_FORMAT_BGRx, SPA_VIDEO_FORMAT_BGRx, SPA_VIDEO_FORMAT_BGRA, SPA_VIDEO_FORMAT_RGBx, SPA_VIDEO_FORMAT_RGBA, SPA_VIDEO_FORMAT_xRGB, SPA_VIDEO_FORMAT_xBGR, SPA_VIDEO_FORMAT_ARGB, SPA_VIDEO_FORMAT_ABGR, SPA_VIDEO_FORMAT_BGR, SPA_VIDEO_FORMAT_RGB, SPA_VIDEO_FORMAT_xRGB_210LE, SPA_VIDEO_FORMAT_xBGR_210LE, SPA_VIDEO_FORMAT_RGBx_102LE, SPA_VIDEO_FORMAT_BGRx_102LE),
        SPA_FORMAT_VIDEO_size, SPA_POD_CHOICE_RANGE_Rectangle(&SPA_RECTANGLE(1920, 1080), &SPA_RECTANGLE(1, 1), &SPA_RECTANGLE(16384, 16384)),
        SPA_FORMAT_VIDEO_framerate, SPA_POD_Fraction(&SPA_FRACTION(0, 1)),
        SPA_FORMAT_VIDEO_maxFramerate, SPA_POD_CHOICE_RANGE_Fraction(&SPA_FRACTION(360, 1), &SPA_FRACTION(0, 1), &SPA_FRACTION(360, 1)));
}

static void on_param_changed(void *data, uint32_t id, const struct spa_pod *param) {
    struct app *a = data;
    if (!param || id != SPA_PARAM_Format) return;
    uint32_t media_type = 0, media_subtype = 0;
    struct spa_video_info_raw info;
    memset(&info, 0, sizeof info);
    if (spa_format_parse(param, &media_type, &media_subtype) < 0 || media_type != SPA_MEDIA_TYPE_video ||
        media_subtype != SPA_MEDIA_SUBTYPE_raw || spa_format_video_raw_parse(param, &info) < 0) {
        say_state(a, "unsupported", "not a raw video format");
        return;
    }
    enum tm_format format;
    if (!tm_format_of(info.format, &format)) {
        say_state(a, "unsupported", "unknown pixel format");
        return;
    }
    a->format = format;
    a->format_width = (int)info.size.width;
    a->format_height = (int)info.size.height;
    a->have_format = true;

    uint8_t buffer[1024];
    struct spa_pod_builder b = SPA_POD_BUILDER_INIT(buffer, sizeof buffer);
    const struct spa_pod *params[3];
    params[0] = spa_pod_builder_add_object(&b, SPA_TYPE_OBJECT_ParamBuffers, SPA_PARAM_Buffers,
        SPA_PARAM_BUFFERS_dataType, SPA_POD_CHOICE_FLAGS_Int((1 << SPA_DATA_MemFd) | (1 << SPA_DATA_MemPtr)));
    params[1] = spa_pod_builder_add_object(&b, SPA_TYPE_OBJECT_ParamMeta, SPA_PARAM_Meta,
        SPA_PARAM_META_type, SPA_POD_Id(SPA_META_Header),
        SPA_PARAM_META_size, SPA_POD_Int(sizeof(struct spa_meta_header)));
    params[2] = spa_pod_builder_add_object(&b, SPA_TYPE_OBJECT_ParamMeta, SPA_PARAM_Meta,
        SPA_PARAM_META_type, SPA_POD_Id(SPA_META_VideoCrop),
        SPA_PARAM_META_size, SPA_POD_Int(sizeof(struct spa_meta_region)));
    pw_stream_update_params(a->stream, params, 3);
}

static void on_state_changed(void *data, enum pw_stream_state old, enum pw_stream_state state, const char *error) {
    (void)old;
    struct app *a = data;
    if (state == PW_STREAM_STATE_STREAMING) a->streaming = true;
    if (state == PW_STREAM_STATE_ERROR) {
        fprintf(stderr, "twinmap-capture: stream error: %s\n", error ? error : "unknown");
        if (a->got_buffer) say_state(a, "closed", NULL);
        else say_state(a, "unsupported", error ? error : "stream error");
    } else if (state == PW_STREAM_STATE_UNCONNECTED && (a->streaming || a->got_buffer)) {
        say_state(a, "closed", NULL);
    }
}

static bool frame_relayout(struct app *a, int width, int height) {
    struct layout l;
    if (!layout_for(width, height, &l)) return false;
    struct stat st;
    if (fstat(a->frame_fd, &st) < 0) {
        say_state(a, "unsupported", strerror(errno));
        return false;
    }
    if ((uint64_t)st.st_size < l.length && ftruncate(a->frame_fd, (off_t)l.length) < 0) {
        say_state(a, "unsupported", strerror(errno));
        return false;
    }
    if (a->map) munmap(a->map, a->map_length);
    a->map = NULL;
    a->have_layout = false;
    void *map = mmap(NULL, l.length, PROT_READ | PROT_WRITE, MAP_SHARED, a->frame_fd, 0);
    if (map == MAP_FAILED) {
        say_state(a, "unsupported", strerror(errno));
        return false;
    }
    a->map = map;
    a->map_length = l.length;
    a->layout = l;
    a->have_layout = true;
    a->relayout_pending = false;
    a->force_snapshot = true;
    return true;
}

static void frame_write(struct app *a, const uint8_t *src, int stride, int x0, int y0) {
    const struct layout *l = &a->layout;
    int bpp = tm_bytes_per_pixel(a->format);
    const uint8_t *origin = src + (ptrdiff_t)y0 * stride + (ptrdiff_t)x0 * bpp;
    size_t row_bytes = (size_t)l->width * 4;
    for (int y = 0; y < l->top_rows; y++)
        tm_convert(a->format, origin + (ptrdiff_t)y * stride, a->map + l->top + (size_t)y * row_bytes, l->width);
    tm_convert(a->format, origin + (ptrdiff_t)(l->height - 1) * stride, a->map + l->bottom, l->width);
    tm_column(a->format, origin, stride, 0, l->height, a->map + l->left);
    tm_column(a->format, origin, stride, l->width - 1, l->height, a->map + l->right);
    uint64_t now = now_ms();
    if (a->force_snapshot || now - a->last_snapshot_ms >= SNAPSHOT_MS) {
        for (int y = 0; y < l->height; y++)
            tm_convert(a->format, origin + (ptrdiff_t)y * stride, a->map + l->snapshot + (size_t)y * row_bytes, l->width);
        a->last_snapshot_ms = now;
        a->force_snapshot = false;
    }
    uint32_t frames = ++a->frames, session = a->session_number, width = (uint32_t)l->width, height = (uint32_t)l->height;
    memcpy(a->map, &frames, 4);
    memcpy(a->map + 4, &session, 4);
    memcpy(a->map + 8, &now, 8);
    memcpy(a->map + 16, &width, 4);
    memcpy(a->map + 20, &height, 4);
}

static void handle_buffer(struct app *a, struct spa_buffer *buf) {
    if (buf->n_datas < 1) return;
    struct spa_data *d = &buf->datas[0];
    if (!a->got_buffer) {
        a->got_buffer = true;
        if (d->type == SPA_DATA_DmaBuf || d->data == NULL) {
            say_state(a, "unsupported", "only DMA-BUF buffers");
            return;
        }
    }
    if (!a->have_format || d->data == NULL || d->chunk == NULL) return;
    if (d->chunk->size == 0 || (d->chunk->flags & SPA_CHUNK_FLAG_CORRUPTED)) return;
    struct spa_meta_header *header = spa_buffer_find_meta_data(buf, SPA_META_Header, sizeof *header);
    if (header && (header->flags & SPA_META_HEADER_FLAG_CORRUPTED)) return;

    int bpp = tm_bytes_per_pixel(a->format);
    int x0 = 0, y0 = 0, w = a->format_width, h = a->format_height;
    struct spa_meta_region *crop = spa_buffer_find_meta_data(buf, SPA_META_VideoCrop, sizeof *crop);
    if (crop && spa_meta_region_is_valid(crop)) {
        x0 = crop->region.position.x;
        y0 = crop->region.position.y;
        w = (int)crop->region.size.width;
        h = (int)crop->region.size.height;
    }
    if (w > MAX_SIDE) w = MAX_SIDE;
    if (h > MAX_SIDE) h = MAX_SIDE;
    if (x0 < 0 || y0 < 0 || w < 1 || h < 1 || (int64_t)x0 + w > a->format_width || (int64_t)y0 + h > a->format_height) return;
    int64_t stride = d->chunk->stride ? d->chunk->stride : (int64_t)bpp * a->format_width;
    if (!tm_chunk_fits(d->chunk->offset, d->maxsize, d->chunk->size, stride, x0, y0, w, h, bpp)) return;
    const uint8_t *src = (const uint8_t *)d->data + d->chunk->offset % d->maxsize;

    if (!a->have_layout || a->layout.width != w || a->layout.height != h) a->relayout_pending = true;
    if (flock(LOCK_FD, LOCK_EX | LOCK_NB) < 0) return;
    bool relayout = a->relayout_pending;
    if (relayout && !frame_relayout(a, w, h)) {
        flock(LOCK_FD, LOCK_UN);
        return;
    }
    frame_write(a, src, (int)stride, x0, y0);
    flock(LOCK_FD, LOCK_UN);
    if (relayout) say_layout(&a->layout);
}

static void on_process(void *data) {
    struct app *a = data;
    struct pw_buffer *newest = NULL, *next;
    while ((next = pw_stream_dequeue_buffer(a->stream))) {
        if (newest) pw_stream_queue_buffer(a->stream, newest);
        newest = next;
    }
    if (!newest) return;
    if (!atomic_load(&a->stopping)) handle_buffer(a, newest->buffer);
    pw_stream_queue_buffer(a->stream, newest);
}

static const struct pw_stream_events stream_events = {
    .version = PW_VERSION_STREAM_EVENTS,
    .state_changed = on_state_changed,
    .param_changed = on_param_changed,
    .process = on_process,
};

static bool pw_start(struct app *a, int fd, guint32 node_id, guint64 serial, bool has_serial) {
    pw_init(NULL, NULL);
    a->pw_loop = pw_thread_loop_new("twinmap-capture", NULL);
    if (!a->pw_loop) {
        close(fd);
        say_state(a, "unsupported", "cannot create the PipeWire loop");
        return false;
    }
    a->pw_context = pw_context_new(pw_thread_loop_get_loop(a->pw_loop), NULL, 0);
    if (!a->pw_context || pw_thread_loop_start(a->pw_loop) < 0) {
        close(fd);
        say_state(a, "unsupported", "cannot start PipeWire");
        return false;
    }
    pw_thread_loop_lock(a->pw_loop);
    a->pw_core = pw_context_connect_fd(a->pw_context, fd, NULL, 0);
    if (!a->pw_core) {
        const char *why = strerror(errno);
        pw_thread_loop_unlock(a->pw_loop);
        say_state(a, "unsupported", why);
        return false;
    }
    struct pw_properties *props = pw_properties_new(PW_KEY_MEDIA_TYPE, "Video", PW_KEY_MEDIA_CATEGORY, "Capture",
                                                    PW_KEY_MEDIA_ROLE, "Screen", NULL);
    if (has_serial) pw_properties_setf(props, "target.object", "%" G_GUINT64_FORMAT, serial);
    a->stream = pw_stream_new(a->pw_core, "twinmap-capture", props);
    if (!a->stream) {
        pw_thread_loop_unlock(a->pw_loop);
        say_state(a, "unsupported", "cannot create the PipeWire stream");
        return false;
    }
    pw_stream_add_listener(a->stream, &a->stream_listener, &stream_events, a);
    uint8_t buffer[1024];
    struct spa_pod_builder b = SPA_POD_BUILDER_INIT(buffer, sizeof buffer);
    const struct spa_pod *params[1] = { enum_format(&b) };
    int res = pw_stream_connect(a->stream, PW_DIRECTION_INPUT, has_serial ? PW_ID_ANY : node_id,
                                PW_STREAM_FLAG_AUTOCONNECT | PW_STREAM_FLAG_MAP_BUFFERS, params, 1);
    pw_thread_loop_unlock(a->pw_loop);
    if (res < 0) {
        say_state(a, "unsupported", strerror(-res));
        return false;
    }
    return true;
}

static void pw_stop(struct app *a) {
    if (!a->pw_loop) return;
    pw_thread_loop_stop(a->pw_loop);
    if (a->stream) pw_stream_destroy(a->stream);
    if (a->pw_core) pw_core_disconnect(a->pw_core);
    if (a->pw_context) pw_context_destroy(a->pw_context);
    pw_thread_loop_destroy(a->pw_loop);
    a->stream = NULL;
    a->pw_core = NULL;
    a->pw_context = NULL;
    a->pw_loop = NULL;
}

static bool parse_uint(const char *s, unsigned long max, unsigned long *out) {
    if (!s[0] || s[0] < '0' || s[0] > '9') return false;
    char *end = NULL;
    errno = 0;
    unsigned long v = strtoul(s, &end, 10);
    if (errno || *end || v > max) return false;
    *out = v;
    return true;
}

int main(int argc, char **argv) {
    setvbuf(stdout, NULL, _IOLBF, 0);
    signal(SIGPIPE, SIG_IGN);
    unsigned long frame_fd = 0, session = 0;
    if (argc != 3 || !parse_uint(argv[1], 4, &frame_fd) || frame_fd < 3 || !parse_uint(argv[2], UINT32_MAX, &session)) {
        fprintf(stderr, "usage: twinmap-capture <frameFd 3|4> <session>\n");
        return 2;
    }
    if (fcntl(LOCK_FD, F_GETFD) < 0 || fcntl((int)frame_fd, F_GETFD) < 0) {
        fprintf(stderr, "twinmap-capture: descriptors 3 and %lu must be open\n", frame_fd);
        return 2;
    }

    static struct app app = { .terminal = ATOMIC_FLAG_INIT };
    struct app *a = &app;
    a->frame_fd = (int)frame_fd;
    a->session_number = (uint32_t)session;
    atomic_init(&a->stopping, false);
    a->loop = g_main_loop_new(NULL, FALSE);

    GIOChannel *in = g_io_channel_unix_new(STDIN_FILENO);
    g_io_channel_set_encoding(in, NULL, NULL);
    g_io_channel_set_flags(in, G_IO_FLAG_NONBLOCK, NULL);
    g_io_add_watch(in, G_IO_IN | G_IO_HUP | G_IO_ERR, on_stdin, a);

    g_main_loop_run(a->loop);

    pw_stop(a);
    portal_close(a);
    if (a->map) munmap(a->map, a->map_length);
    g_io_channel_unref(in);
    g_clear_object(&a->bus);
    g_free(a->restore_token);
    g_free(a->expected_session);
    g_main_loop_unref(a->loop);
    return a->exit_code;
}
