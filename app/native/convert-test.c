#define _GNU_SOURCE 1
#include "convert.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>

static void encode(enum tm_format f, uint8_t *p, int v, int a, int mid) {
    unsigned r = mid ? 512 : ((v & 4) ? 1023 : 0);
    unsigned g = mid ? 512 : ((v & 2) ? 1023 : 0);
    unsigned b = mid ? 512 : ((v & 1) ? 1023 : 0);
    unsigned R = r >> 2, G = g >> 2, B = b >> 2;
    uint32_t w = 0;
    switch (f) {
    case TM_BGRX: case TM_BGRA: p[0]=B; p[1]=G; p[2]=R; p[3]=a; return;
    case TM_RGBX: case TM_RGBA: p[0]=R; p[1]=G; p[2]=B; p[3]=a; return;
    case TM_XRGB: case TM_ARGB: p[0]=a; p[1]=R; p[2]=G; p[3]=B; return;
    case TM_XBGR: case TM_ABGR: p[0]=a; p[1]=B; p[2]=G; p[3]=R; return;
    case TM_BGR: p[0]=B; p[1]=G; p[2]=R; return;
    case TM_RGB: p[0]=R; p[1]=G; p[2]=B; return;
    case TM_XRGB_210LE: w=((unsigned)a << 30)|(r<<20)|(g<<10)|b; break;
    case TM_XBGR_210LE: w=((unsigned)a << 30)|(b<<20)|(g<<10)|r; break;
    case TM_RGBX_102LE: w=(r<<22)|(g<<12)|(b<<2)|(unsigned)a; break;
    case TM_BGRX_102LE: w=(b<<22)|(g<<12)|(r<<2)|(unsigned)a; break;
    }
    for (int i=0; i<4; i++) p[i]=(uint8_t)(w >> (8*i));
}

static void colours(void) {
    for (int f=TM_BGRX; f<=TM_BGRX_102LE; f++) {
        int bpp = tm_bytes_per_pixel((enum tm_format)f);
        assert(bpp == ((f == TM_BGR || f == TM_RGB) ? 3 : 4));
        for (int a=0; a<2; a++) for (int start=0; start<8; start+=3) {
            uint8_t src[12]={0}, dst[12]={0};
            int n = 8-start < 3 ? 8-start : 3;
            for (int i=0; i<n; i++) encode((enum tm_format)f, src+i*bpp, start+i,
                f >= TM_XRGB_210LE ? (a ? 3 : 0) : (a ? 0x7f : 0), 0);
            tm_convert((enum tm_format)f, src, dst, n);
            for (int i=0; i<n; i++) {
                int v=start+i;
                assert(dst[4*i] == ((v&1) ? 255 : 0));
                assert(dst[4*i+1] == ((v&2) ? 255 : 0));
                assert(dst[4*i+2] == ((v&4) ? 255 : 0));
                assert(dst[4*i+3] == 255);
            }
        }
        if (f >= TM_XRGB_210LE) {
            uint8_t src[4], dst[4];
            encode((enum tm_format)f, src, 0, 3, 1);
            tm_convert((enum tm_format)f, src, dst, 1);
            assert(dst[0]==128 && dst[1]==128 && dst[2]==128 && dst[3]==255);
        }
    }
}

static void columns(enum tm_format f, int stride) {
    uint8_t src[64], dst[16];
    memset(src, 0xcc, sizeof(src));
    int bpp=tm_bytes_per_pixel(f);
    for (int y=0; y<4; y++) for (int x=0; x<3; x++)
        encode(f, src+y*stride+x*bpp, (y*3+x)%8, 0, 0);
    for (int x=0; x<=2; x+=2) {
        memset(dst, 0, sizeof(dst));
        tm_column(f, src, stride, x, 4, dst);
        for (int y=0; y<4; y++) {
            int v=(y*3+x)%8;
            assert(dst[4*y]==((v&1)?255:0));
            assert(dst[4*y+1]==((v&2)?255:0));
            assert(dst[4*y+2]==((v&4)?255:0));
            assert(dst[4*y+3]==255);
        }
    }
}

int main(void) {
    assert(tm_chunk_fits(8, 40, 32, 12, 0, 0, 2, 3, 4));
    assert(!tm_chunk_fits(8, 40, 31, 12, 0, 0, 2, 3, 4));
    assert(!tm_chunk_fits(8, 39, 32, 12, 0, 0, 2, 3, 4));
    assert(tm_chunk_fits(48, 40, UINT32_MAX, 12, 0, 0, 2, 3, 4));
    assert(!tm_chunk_fits(39, 40, UINT32_MAX, 12, 0, 0, 2, 3, 4));
    assert(!tm_chunk_fits(0, 0, 32, 12, 0, 0, 2, 3, 4));
    assert(tm_buffer_fits(0, 32, 12, 0, 0, 2, 3, 4));
    assert(!tm_buffer_fits(0, 31, 12, 0, 0, 2, 3, 4));
    assert(!tm_buffer_fits(0, 100, 12, 2, 0, 2, 1, 4));
    assert(!tm_buffer_fits(UINT32_MAX, UINT32_MAX, INT32_MAX, INT32_MAX, INT32_MAX, INT32_MAX, INT32_MAX, 4));
    colours();
    columns(TM_BGRX, 16);
    columns(TM_BGR, 12);
    puts("ok");
    return 0;
}
