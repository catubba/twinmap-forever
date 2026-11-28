#ifndef TM_CONVERT_H
#define TM_CONVERT_H
#include <stdint.h>
enum tm_format { TM_BGRX, TM_BGRA, TM_RGBX, TM_RGBA, TM_XRGB, TM_XBGR, TM_ARGB, TM_ABGR, TM_BGR, TM_RGB, TM_XRGB_210LE, TM_XBGR_210LE, TM_RGBX_102LE, TM_BGRX_102LE };
int tm_bytes_per_pixel(enum tm_format f);
void tm_convert(enum tm_format f, const uint8_t *src, uint8_t *dst_bgra, int pixels);
void tm_column(enum tm_format f, const uint8_t *src, int stride, int x, int height, uint8_t *dst_bgra);
int tm_buffer_fits(uint32_t offset, uint32_t size, int64_t stride, int x, int y, int width, int height, int bpp);
int tm_chunk_fits(uint32_t offset, uint32_t maxsize, uint32_t size, int64_t stride, int x, int y, int width, int height, int bpp);
#endif
