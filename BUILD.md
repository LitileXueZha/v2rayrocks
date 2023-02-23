# BUILD

## Privoxy

### Windows

Download source code, use the [version v3.0.29](https://www.privoxy.org/sf-download-mirror/Sources/) (no PCRE extra setups).

Privoxy only supports 32 bit, so it needs **MingW x32 GCC** to be built, otherwise finally x64 linker will throw incompatible error.

```shell
$ pacman -S mingw-w64-i686-gcc
```

> Use `CFLAGS` = `"-Os"` for smaller size, see [Optimize Options](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html).

Remove log window, taskbar (Tray). Edit `GNUmakefile.in`:

```diff
- W32_SRC   = @WIN_ONLY@w32log.c w32taskbar.c win32.c w32svrapi.c
+ W32_SRC   = @WIN_ONLY@win32.c w32svrapi.c
```

Take a coffee or `make coffee` 😂

```bash
pacman -S autoconf2.69
ln -s /usr/bin/autoconf-2.69 /usr/bin/autoconf
ln -s /usr/bin/autoheader-2.69 /usr/bin/autoheader
autoheader
autoconf

./configure --host=i686-w64-mingw32 --enable-mingw32 \
            --enable-zlib \
            --enable-static-linking \
            --enable-strptime-sanity-checks \
            --disable-dynamic-pcre \
            --disable-pthread \
            --disable-stats \
            --disable-image-blocking \
            --with-docbook=no \
            CFLAGS="-Os -Wshadow -D_WIN_CONSOLE" \
            LDFLAGS="-Wl,--nxcompat -Wl,--dynamicbase,--export-all-symbols"

make
```

> Close any other applications which are watching on the directory, eg: Windows Defender, IDE...
