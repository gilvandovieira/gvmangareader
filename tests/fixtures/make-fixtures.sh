#!/usr/bin/env sh
# Regenerates mixed.cbz. Needs ImageMagick (magick), libjxl (cjxl) and python3; none are runtime dependencies.
set -eu
cd "$(dirname "$0")"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

page() { # page <file> <background> <label>
  magick -size 300x420 "xc:$2" -gravity center -pointsize 44 -fill black -annotate 0 "$3" "$work/$1"
}

page 01.png '#fde68a' '1 JXL'
cjxl --quiet -d 1 "$work/01.png" "$work/01.jxl"
page 02.png '#a7f3d0' '2 PNG'
page 03.jpg '#bfdbfe' '3 JPEG'
# A JXL signature followed by garbage: no decoder can make an image out of it.
printf '\377\012not a jpeg xl codestream' > "$work/04.jxl"
page 05.jpg '#fbcfe8' '5 JXL'
cjxl --quiet --lossless_jpeg=1 "$work/05.jpg" "$work/05.jxl"
echo '<ComicInfo/>' > "$work/ComicInfo.xml"

rm -f mixed.cbz
(cd "$work" && python3 -m zipfile -c "$OLDPWD/mixed.cbz" 01.jxl 02.png 03.jpg 04.jxl 05.jxl ComicInfo.xml)
