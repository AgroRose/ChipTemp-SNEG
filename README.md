# 🌡️ ChipTemp by SNEG

GNOME Shell extension for real-time CPU and GPU temperature monitoring with live graphs.

## ✨ Features

- 🌡️ **Real-time monitoring** — CPU and GPU temperatures displayed directly in the panel
- 📈 **Live graphs** — Interactive graph showing temperature history over 2 minutes
- 📊 **Statistics** — Min/Max temperature tracking
- 🎨 **Theme adaptive** — Automatically adjusts to light/dark theme
- ⚡ **Lightweight** — Updates every 2 seconds with minimal resource usage
- 🖼️ **Custom icons** — Thermometer with sun (CPU) and snowflake (GPU)

## 📦 Installation

### From source

```bash
git clone https://github.com/infaman/ChipTemp-SNEG.git
cd ChipTemp-SNEG

mkdir -p ~/.local/share/gnome-shell/extensions/ChipTemp@SNEG
cp metadata.json extension.js ~/.local/share/gnome-shell/extensions/ChipTemp@SNEG/
cp -r icons ~/.local/share/gnome-shell/extensions/ChipTemp@SNEG/

gnome-extensions enable ChipTemp@SNEG
