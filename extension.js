import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

let Adw = null;
try { Adw = await import('gi://Adw'); } catch (e) {}

const LIGHT = {
    bg: [0.96, 0.96, 0.96, 1.0],
    text: [0.15, 0.15, 0.15, 1.0],
    grid: [0.78, 0.78, 0.78, 0.9],
    axis: [0.4, 0.4, 0.4, 1.0]
};
const DARK = {
    bg: [0.12, 0.12, 0.14, 1.0],
    text: [0.92, 0.92, 0.92, 1.0],
    grid: [0.32, 0.32, 0.35, 0.7],
    axis: [0.75, 0.75, 0.75, 1.0]
};

function isDarkTheme() {
    try {
        const s = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        const scheme = s.get_string('color-scheme');
        const theme = s.get_string('gtk-theme').toLowerCase();
        if (scheme === 'prefer-dark') return true;
        if (scheme === 'prefer-light') return false;
        if (theme.includes('dark') && !theme.includes('light')) return true;
        return false;
    } catch (e) {}
    if (Adw && Adw.StyleManager) {
        try { return Adw.StyleManager.get_default().get_dark(); } catch (e) {}
    }
    return false;
}

export default class ChipTempExtension extends Extension {
    enable() {
        this._cpuHistory = [];
        this._gpuHistory = [];
        this._colors = isDarkTheme() ? DARK : LIGHT;

        this._indicator = new PanelMenu.Button(0.0, 'ChipTemp', false);
        let box = new St.BoxLayout({style_class: 'panel-status-menu-box'});

        // CPU — термометр с солнцем (иконка ч/б, наследует цвет панели)
        this._cpuIcon = new St.Icon({
            gicon: Gio.FileIcon.new(Gio.File.new_for_path(this.path + '/icons/chiptemp-cpu-symbolic.svg')),
            style_class: 'system-status-icon',
            y_expand: true, y_align: Clutter.ActorAlign.CENTER
        });
        this._cpuLabel = new St.Label({
            text: '--°', y_expand: true, y_align: Clutter.ActorAlign.CENTER
        });
        this._cpuLabel.set_style('color: #ff9800; font-weight: bold;');

        box.add_child(this._cpuIcon);
        box.add_child(this._cpuLabel);
        box.add_child(new St.Label({text: '  '}));

        // GPU — термометр со снежинкой (иконка ч/б)
        this._gpuIcon = new St.Icon({
            gicon: Gio.FileIcon.new(Gio.File.new_for_path(this.path + '/icons/chiptemp-gpu-symbolic.svg')),
            style_class: 'system-status-icon',
            y_expand: true, y_align: Clutter.ActorAlign.CENTER
        });
        this._gpuLabel = new St.Label({
            text: '--°', y_expand: true, y_align: Clutter.ActorAlign.CENTER
        });
        this._gpuLabel.set_style('color: #4caf50; font-weight: bold;');

        box.add_child(this._gpuIcon);
        box.add_child(this._gpuLabel);

        this._indicator.add_child(box);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._graphArea = new St.DrawingArea({style: 'border-radius: 6px;'});
        this._graphArea.set_size(340, 180);
        this._graphArea.connect('repaint', (area) => this._drawGraph(area));

        let graphItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        graphItem.add_child(this._graphArea);
        this._indicator.menu.addMenuItem(graphItem);

        this._infoLabel = new St.Label({text: 'Загрузка...'});
        this._infoLabel.set_style('padding: 8px; font-size: 10pt;');
        let infoItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        infoItem.add_child(this._infoLabel);
        this._indicator.menu.addMenuItem(infoItem);

        this._themeSignalId = 0;
        if (Adw && Adw.StyleManager) {
            const sm = Adw.StyleManager.get_default();
            this._themeSignalId = sm.connect('notify::dark', () => {
                this._colors = isDarkTheme() ? DARK : LIGHT;
                this._graphArea.queue_repaint();
            });
        }
        this._settings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        this._settingsSignalId = this._settings.connect('changed::color-scheme', () => {
            this._colors = isDarkTheme() ? DARK : LIGHT;
            this._graphArea.queue_repaint();
        });

        this._update();
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, this._update.bind(this));
    }

    _drawGraph(area) {
        let cr = area.get_context();
        let width = 340, height = 180;
        const lm = 35, bm = 20, tm = 25, rm = 10;
        const gw = width - lm - rm, gh = height - tm - bm;
        const [br, bg, bb, ba] = this._colors.bg;
        const [tr, tg, tb, ta] = this._colors.text;
        const [gr, gg, gb, ga] = this._colors.grid;
        const [ar, ag, ab, aa] = this._colors.axis;

        cr.save();
        cr.setSourceRGBA(br, bg, bb, ba);
        cr.rectangle(0, 0, width, height);
        cr.fill();
        cr.restore();

        cr.save();
        cr.setSourceRGBA(tr, tg, tb, ta);
        cr.selectFontFace('Sans', 0, 0);
        cr.setFontSize(10);
        cr.moveTo(lm, 15);
        cr.showText('Температура за 2 минуты');
        cr.restore();

        cr.save();
        cr.selectFontFace('Sans', 0, 0);
        cr.setFontSize(9);
        cr.setSourceRGBA(1.0, 0.6, 0.0, 1.0);
        cr.rectangle(lm, 30, 10, 10);
        cr.fill();
        cr.setSourceRGBA(ar, ag, ab, aa);
        cr.moveTo(lm + 13, 39);
        cr.showText('CPU');
        cr.setSourceRGBA(0.3, 0.8, 0.3, 1.0);
        cr.rectangle(lm + 50, 30, 10, 10);
        cr.fill();
        cr.setSourceRGBA(ar, ag, ab, aa);
        cr.moveTo(lm + 63, 39);
        cr.showText('GPU');
        cr.restore();

        cr.save();
        cr.selectFontFace('Sans', 0, 0);
        cr.setFontSize(9);
        const yLabels = [100, 75, 50, 25, 0];
        for (let i = 0; i < yLabels.length; i++) {
            let y = tm + (gh / (yLabels.length - 1)) * i;
            let label = `${yLabels[i]}°`;
            let ext = cr.textExtents(label);
            cr.setSourceRGBA(ar, ag, ab, aa);
            cr.moveTo(lm - 5 - ext.width, y + ext.height / 2);
            cr.showText(label);
            cr.newPath();
            cr.setSourceRGBA(gr, gg, gb, ga);
            cr.moveTo(lm, y);
            cr.lineTo(lm + gw, y);
            cr.stroke();
        }
        cr.restore();

        cr.save();
        cr.selectFontFace('Sans', 0, 0);
        cr.setFontSize(9);
        const xLabels = ['2м', '1м', 'сейчас'];
        for (let i = 0; i < xLabels.length; i++) {
            let x = lm + (gw / (xLabels.length - 1)) * i;
            let label = xLabels[i];
            let ext = cr.textExtents(label);
            cr.setSourceRGBA(ar, ag, ab, aa);
            cr.moveTo(x - ext.width / 2, height - 5);
            cr.showText(label);
        }
        cr.restore();

        this._drawSeries(cr, this._cpuHistory, lm, tm, gw, gh, 1.0, 0.6, 0.0);
        this._drawSeries(cr, this._gpuHistory, lm, tm, gw, gh, 0.3, 0.8, 0.3);
    }

    _drawSeries(cr, data, lm, tm, gw, gh, r, g, b) {
        if (data.length < 2) return;
        let step = gw / (data.length - 1);
        cr.save();
        cr.setSourceRGBA(r, g, b, 1.0);
        cr.setLineWidth(2);
        cr.newPath();
        for (let i = 0; i < data.length; i++) {
            let x = lm + i * step;
            let y = tm + gh - (data[i] / 100) * gh;
            if (i === 0) cr.moveTo(x, y); else cr.lineTo(x, y);
        }
        cr.stroke();
        cr.restore();
    }

    disable() {
        if (this._timeout) { GLib.source_remove(this._timeout); this._timeout = null; }
        if (this._themeSignalId && Adw && Adw.StyleManager) {
            Adw.StyleManager.get_default().disconnect(this._themeSignalId);
            this._themeSignalId = 0;
        }
        if (this._settingsSignalId && this._settings) {
            this._settings.disconnect(this._settingsSignalId);
            this._settingsSignalId = 0;
        }
        if (this._indicator) { this._indicator.destroy(); this._indicator = null; }
    }

    _update() {
        let cpu = Math.floor(Math.random() * (85 - 40 + 1)) + 40;
        let gpu = Math.floor(Math.random() * (75 - 35 + 1)) + 35;
        this._cpuLabel.set_text(`${cpu}°`);
        this._gpuLabel.set_text(`${gpu}°`);
        this._cpuHistory.push(cpu);
        this._gpuHistory.push(gpu);
        if (this._cpuHistory.length > 60) this._cpuHistory.shift();
        if (this._gpuHistory.length > 60) this._gpuHistory.shift();
        this._graphArea.queue_repaint();
        let cMin = Math.min(...this._cpuHistory), cMax = Math.max(...this._cpuHistory);
        let gMin = Math.min(...this._gpuHistory), gMax = Math.max(...this._gpuHistory);
        this._infoLabel.set_text(`CPU: ${cpu}° (Min/Max: ${cMin}°/${cMax}°) | GPU: ${gpu}° (Min/Max: ${gMin}°/${gMax}°)`);
        return GLib.SOURCE_CONTINUE;
    }
}
