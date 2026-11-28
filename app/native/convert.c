#define _GNU_SOURCE 1
#include "convert.h"
#include <stddef.h>

int tm_bytes_per_pixel(enum tm_format f) {
    if (f == TM_BGR || f == TM_RGB) return 3;
    if (f >= TM_BGRX && f <= TM_BGRX_102LE) return 4;
    return 0;
}

void tm_convert(enum tm_format f, const uint8_t *src, uint8_t *dst_bgra, int pixels) {
    int bpp = tm_bytes_per_pixel(f);
    if (!bpp) return;
    for (int i=0; i<pixels; i++, src+=bpp, dst_bgra+=4) {
        uint8_t b=0, g=0, r=0;
        switch (f) {
        case TM_BGRX: case TM_BGRA: case TM_BGR:
            b=src[0]; g=src[1]; r=src[2]; break;
        case TM_RGBX: case TM_RGBA: case TM_RGB:
            r=src[0]; g=src[1]; b=src[2]; break;
        case TM_XRGB: case TM_ARGB:
            r=src[1]; g=src[2]; b=src[3]; break;
        case TM_XBGR: case TM_ABGR:
            b=src[1]; g=src[2]; r=src[3]; break;
        case TM_XRGB_210LE: case TM_XBGR_210LE:
        case TM_RGBX_102LE: case TM_BGRX_102LE: {
            uint32_t w=(uint32_t)src[0] | ((uint32_t)src[1]<<8) |
                ((uint32_t)src[2]<<16) | ((uint32_t)src[3]<<24);
            int offset = (f == TM_RGBX_102LE || f == TM_BGRX_102LE) ? 2 : 0;
            uint8_t low=(uint8_t)((w >> (offset+2)) & 0xff);
            uint8_t high=(uint8_t)((w >> (offset+22)) & 0xff);
            g=(uint8_t)((w >> (offset+12)) & 0xff);
            if (f == TM_XRGB_210LE || f == TM_RGBX_102LE) { b=low; r=high; }
            else { r=low; b=high; }
            break;
        }
        }
        dst_bgra[0]=b; dst_bgra[1]=g; dst_bgra[2]=r; dst_bgra[3]=255;
    }
}

void tm_column(enum tm_format f, const uint8_t *src, int stride, int x, int height, uint8_t *dst_bgra) {
    int bpp=tm_bytes_per_pixel(f);
    if (!bpp) return;
    src += (ptrdiff_t)x*bpp;
    for (int y=0; y<height; y++)
        tm_convert(f, src + (ptrdiff_t)y*stride, dst_bgra + (ptrdiff_t)y*4, 1);
}

int tm_buffer_fits(uint32_t offset, uint32_t size, int64_t stride, int x, int y, int width, int height, int bpp) {
    if (x < 0 || y < 0 || width < 1 || height < 1 || bpp < 1 || stride < 1 || stride > INT32_MAX) return 0;
    uint64_t row = ((uint64_t)x + (uint64_t)width) * (uint64_t)bpp;
    if (row > (uint64_t)stride || offset > size) return 0;
    uint64_t remaining = (uint64_t)size - offset;
    uint64_t rows = (uint64_t)y + (uint64_t)height - 1;
    return row <= remaining && rows <= (remaining - row) / (uint64_t)stride;
}

int tm_chunk_fits(uint32_t offset, uint32_t maxsize, uint32_t size, int64_t stride, int x, int y, int width, int height, int bpp) {
    if (!maxsize) return 0;
    offset %= maxsize;
    if (size > maxsize) size = maxsize;
    if (size > maxsize - offset) size = maxsize - offset;
    return tm_buffer_fits(0, size, stride, x, y, width, height, bpp);
}
