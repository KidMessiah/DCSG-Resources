"""
Constellation Editor - a small desktop tool for placing and connecting
star points directly on top of the "Mid-Year Night Sky Negresh" chart,
instead of having an AI eyeball pixel coordinates from a picture.

Run it with:  python tools/constellation_editor.py

Controls:
  Left-click empty space   - add a star. If another star is selected
                              (highlighted), the new one is connected to it,
                              and becomes the new selection - so clicking
                              star after star draws a connected chain.
  Left-click an existing star
                            - if a different star is selected, toggles a
                              line between them and selects the one you
                              just clicked (so you can keep branching from
                              there). Click the selected star again to
                              deselect without connecting anything.
  Drag a star               - move it (a small drag threshold keeps this
                              from fighting with plain clicks).
  Right-click a star        - delete it (and any lines touching it).
  Right-click a line        - delete just that line.
  Mouse wheel                - zoom in/out, centered on the cursor.
  Middle-click drag           - pan the view.
  Prev / Next buttons (or PageUp/PageDown) - switch constellations.
  Save All                  - writes every constellation back to
                              content/constellations.json in the format
                              widgets/constellation.js already reads.

Coordinates are stored in full source-image pixel space (against
images/starmap2.png), matching what's already in constellations.json, so
saving here never requires touching the website's JS.
"""

import json
import os
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog

from PIL import Image, ImageTk

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_PATH = os.path.join(ROOT, 'images', 'starmap2.png')
DATA_PATH = os.path.join(ROOT, 'content', 'constellations.json')

CANVAS_W = 900
CANVAS_H = 650
POINT_R = 6
HIT_R = 10
LINE_HIT_DIST = 6

# Default framing per constellation (full-image pixel box), so opening one
# starts zoomed roughly to that shape instead of the whole 2000x2000 chart.
# Feel free to nudge these if a shape doesn't fully fit - the mouse wheel
# and middle-drag also work freely once the tool is open.
DEFAULT_CROPS = {
    'Third': (230, 320, 480, 560),
    'Dominion': (660, 180, 900, 420),
    'Love': (1160, 320, 1420, 540),
    'Seventh': (1530, 450, 1820, 740),
    'First and Second': (380, 620, 740, 920),
    'Ninth': (860, 600, 1070, 920),
    'Hope': (150, 770, 390, 1110),
    'Charity': (1480, 780, 1850, 1140),
    'Fifth': (540, 930, 740, 1220),
    'Eighth': (1060, 860, 1220, 1140),
    'Legion': (770, 910, 1080, 1140),
    'Surety': (1220, 920, 1490, 1200),
    'Fourth': (140, 1120, 420, 1350),
    'Sixth': (1570, 1250, 1770, 1540),
    'Might': (420, 1280, 640, 1670),
    'Need': (1260, 1230, 1580, 1500),
    'Courage': (980, 1230, 1320, 1540),
    'Suffering': (1160, 1460, 1490, 1840),
    'Community': (760, 1660, 1070, 1920),
}


def load_data():
    if os.path.exists(DATA_PATH):
        with open(DATA_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {'imageWidth': 2000, 'imageHeight': 2000, 'constellations': []}


class ConstellationEditor:
    def __init__(self, root):
        self.root = root
        self.root.title('Constellation Editor')

        self.data = load_data()
        self.image = Image.open(IMAGE_PATH).convert('RGB')
        self.index = 0
        self.selected = None  # index into current constellation's stars
        self.drag_index = None
        self.drag_moved = False
        self.drag_start = (0, 0)
        self.pan_start = None
        self.photo = None  # keep a reference so Tk doesn't garbage-collect it

        self.view_x = 0.0
        self.view_y = 0.0
        self.view_scale = 1.0

        self._build_ui()
        if not self.data['constellations']:
            self.add_constellation('New constellation')
        self._frame_current(reset=True)
        self._redraw()

    # ---------- UI ----------
    def _build_ui(self):
        top = ttk.Frame(self.root)
        top.pack(fill='x', padx=8, pady=6)

        ttk.Button(top, text='< Prev', command=self.prev_constellation).pack(side='left')
        ttk.Button(top, text='Next >', command=self.next_constellation).pack(side='left', padx=(4, 12))
        ttk.Button(top, text='New', command=lambda: self.add_constellation('New constellation')).pack(side='left')
        ttk.Button(top, text='Delete Current', command=self.delete_current).pack(side='left', padx=(4, 12))
        ttk.Button(top, text='Reset View', command=lambda: self._frame_current(reset=True)).pack(side='left')
        ttk.Button(top, text='Clear Points', command=self.clear_points).pack(side='left', padx=(4, 12))

        self.pos_label = ttk.Label(top, text='')
        self.pos_label.pack(side='right')

        name_row = ttk.Frame(self.root)
        name_row.pack(fill='x', padx=8)
        ttk.Label(name_row, text='Name:').pack(side='left')
        self.name_var = tk.StringVar()
        self.name_var.trace_add('write', lambda *_: self._on_name_edit())
        ttk.Entry(name_row, textvariable=self.name_var).pack(side='left', fill='x', expand=True, padx=6)

        self.canvas = tk.Canvas(self.root, width=CANVAS_W, height=CANVAS_H, bg='black', cursor='crosshair')
        self.canvas.pack(padx=8, pady=6)
        self.canvas.bind('<Button-1>', self._on_left_down)
        self.canvas.bind('<B1-Motion>', self._on_left_drag)
        self.canvas.bind('<ButtonRelease-1>', self._on_left_up)
        self.canvas.bind('<Button-3>', self._on_right_click)
        self.canvas.bind('<MouseWheel>', self._on_wheel)       # Windows/Mac
        self.canvas.bind('<Button-4>', lambda e: self._zoom(e, 1.15))   # Linux scroll up
        self.canvas.bind('<Button-5>', lambda e: self._zoom(e, 1 / 1.15))  # Linux scroll down
        self.canvas.bind('<ButtonPress-2>', self._on_pan_start)
        self.canvas.bind('<B2-Motion>', self._on_pan_move)
        self.canvas.bind('<Motion>', self._on_hover)

        self.root.bind('<Prior>', lambda e: self.prev_constellation())   # Page Up
        self.root.bind('<Next>', lambda e: self.next_constellation())    # Page Down
        self.root.bind('<Escape>', lambda e: self._deselect())

        desc_row = ttk.Frame(self.root)
        desc_row.pack(fill='both', expand=True, padx=8, pady=(0, 6))
        ttk.Label(desc_row, text='Description:').pack(anchor='w')
        self.desc_text = tk.Text(desc_row, height=4, wrap='word')
        self.desc_text.pack(fill='both', expand=True)
        self.desc_text.bind('<KeyRelease>', lambda e: self._on_desc_edit())

        bottom = ttk.Frame(self.root)
        bottom.pack(fill='x', padx=8, pady=(0, 8))
        ttk.Button(bottom, text='Save All', command=self.save_all).pack(side='right')
        self.status_label = ttk.Label(bottom, text='')
        self.status_label.pack(side='left')

    # ---------- data helpers ----------
    def current(self):
        return self.data['constellations'][self.index]

    def add_constellation(self, name):
        self.data['constellations'].append({
            'name': name, 'description': '', 'stars': [], 'lines': []
        })
        self.index = len(self.data['constellations']) - 1
        DEFAULT_CROPS.setdefault(name, (900, 900, 1100, 1100))
        self._sync_fields()
        self._frame_current(reset=True)
        self._redraw()

    def delete_current(self):
        if not self.data['constellations']:
            return
        name = self.current()['name']
        if not messagebox.askyesno('Delete constellation', 'Delete "%s"? This cannot be undone.' % name):
            return
        del self.data['constellations'][self.index]
        if not self.data['constellations']:
            self.add_constellation('New constellation')
        self.index = max(0, min(self.index, len(self.data['constellations']) - 1))
        self._sync_fields()
        self._frame_current(reset=True)
        self._redraw()

    def clear_points(self):
        if not messagebox.askyesno('Clear points', 'Remove every star and line from "%s"?' % self.current()['name']):
            return
        self.current()['stars'] = []
        self.current()['lines'] = []
        self.selected = None
        self._redraw()

    def prev_constellation(self):
        if not self.data['constellations']:
            return
        self.index = (self.index - 1) % len(self.data['constellations'])
        self.selected = None
        self._sync_fields()
        self._frame_current(reset=True)
        self._redraw()

    def next_constellation(self):
        if not self.data['constellations']:
            return
        self.index = (self.index + 1) % len(self.data['constellations'])
        self.selected = None
        self._sync_fields()
        self._frame_current(reset=True)
        self._redraw()

    def _sync_fields(self):
        c = self.current()
        self.name_var.set(c['name'])
        self.desc_text.delete('1.0', 'end')
        self.desc_text.insert('1.0', c.get('description', ''))
        self.status_label.config(
            text='Constellation %d / %d' % (self.index + 1, len(self.data['constellations']))
        )

    def _on_name_edit(self):
        if self.data['constellations']:
            self.current()['name'] = self.name_var.get()

    def _on_desc_edit(self):
        if self.data['constellations']:
            self.current()['description'] = self.desc_text.get('1.0', 'end-1c')

    # ---------- view (pan/zoom) ----------
    def _frame_current(self, reset=False):
        if not reset:
            return
        name = self.current()['name']
        box = DEFAULT_CROPS.get(name, (900, 900, 1100, 1100))
        x0, y0, x1, y1 = box
        w, h = max(1, x1 - x0), max(1, y1 - y0)
        self.view_scale = min(CANVAS_W / w, CANVAS_H / h)
        self.view_x = x0
        self.view_y = y0

    def img_to_canvas(self, x, y):
        return (x - self.view_x) * self.view_scale, (y - self.view_y) * self.view_scale

    def canvas_to_img(self, cx, cy):
        return self.view_x + cx / self.view_scale, self.view_y + cy / self.view_scale

    def _on_wheel(self, event):
        factor = 1.15 if event.delta > 0 else 1 / 1.15
        self._zoom(event, factor)

    def _zoom(self, event, factor):
        anchor_x, anchor_y = self.canvas_to_img(event.x, event.y)
        self.view_scale = max(0.1, min(self.view_scale * factor, 20))
        self.view_x = anchor_x - event.x / self.view_scale
        self.view_y = anchor_y - event.y / self.view_scale
        self._redraw()

    def _on_pan_start(self, event):
        self.pan_start = (event.x, event.y, self.view_x, self.view_y)

    def _on_pan_move(self, event):
        if self.pan_start is None:
            return
        sx, sy, vx0, vy0 = self.pan_start
        self.view_x = vx0 - (event.x - sx) / self.view_scale
        self.view_y = vy0 - (event.y - sy) / self.view_scale
        self._redraw()

    # ---------- picking ----------
    def _star_near(self, cx, cy, radius=HIT_R):
        stars = self.current()['stars']
        best, best_d = None, radius
        for i, s in enumerate(stars):
            sx, sy = self.img_to_canvas(s['x'], s['y'])
            d = ((sx - cx) ** 2 + (sy - cy) ** 2) ** 0.5
            if d <= best_d:
                best, best_d = i, d
        return best

    def _line_near(self, cx, cy, radius=LINE_HIT_DIST):
        stars = self.current()['stars']
        lines = self.current()['lines']
        best, best_d = None, radius
        for li, (a, b) in enumerate(lines):
            if a >= len(stars) or b >= len(stars):
                continue
            ax, ay = self.img_to_canvas(stars[a]['x'], stars[a]['y'])
            bx, by = self.img_to_canvas(stars[b]['x'], stars[b]['y'])
            d = self._point_segment_dist(cx, cy, ax, ay, bx, by)
            if d <= best_d:
                best, best_d = li, d
        return best

    @staticmethod
    def _point_segment_dist(px, py, ax, ay, bx, by):
        dx, dy = bx - ax, by - ay
        length_sq = dx * dx + dy * dy
        if length_sq == 0:
            return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
        proj_x, proj_y = ax + t * dx, ay + t * dy
        return ((px - proj_x) ** 2 + (py - proj_y) ** 2) ** 0.5

    # ---------- mouse handlers ----------
    def _on_left_down(self, event):
        hit = self._star_near(event.x, event.y)
        self.drag_index = hit
        self.drag_moved = False
        self.drag_start = (event.x, event.y)

    def _on_left_drag(self, event):
        if self.drag_index is None:
            return
        if not self.drag_moved:
            dx = event.x - self.drag_start[0]
            dy = event.y - self.drag_start[1]
            if (dx * dx + dy * dy) ** 0.5 < 4:
                return
            self.drag_moved = True
        fx, fy = self.canvas_to_img(event.x, event.y)
        self.current()['stars'][self.drag_index]['x'] = fx
        self.current()['stars'][self.drag_index]['y'] = fy
        self._redraw()

    def _on_left_up(self, event):
        if self.drag_index is not None and self.drag_moved:
            self.drag_index = None
            self.drag_moved = False
            return
        self.drag_index = None
        self.drag_moved = False

        hit = self._star_near(event.x, event.y)
        stars = self.current()['stars']
        lines = self.current()['lines']

        if hit is None:
            fx, fy = self.canvas_to_img(event.x, event.y)
            stars.append({'x': fx, 'y': fy})
            new_index = len(stars) - 1
            if self.selected is not None and self.selected != new_index:
                self._toggle_line(self.selected, new_index)
            self.selected = new_index
        else:
            if self.selected is None:
                self.selected = hit
            elif self.selected == hit:
                self.selected = None
            else:
                self._toggle_line(self.selected, hit)
                self.selected = hit

        self._redraw()

    def _toggle_line(self, a, b):
        lines = self.current()['lines']
        pair = [a, b]
        for i, ln in enumerate(lines):
            if set(ln) == set(pair):
                del lines[i]
                return
        lines.append(pair)

    def _on_right_click(self, event):
        hit = self._star_near(event.x, event.y)
        stars = self.current()['stars']
        lines = self.current()['lines']
        if hit is not None:
            del stars[hit]
            new_lines = []
            for a, b in lines:
                if a == hit or b == hit:
                    continue
                new_lines.append([a - 1 if a > hit else a, b - 1 if b > hit else b])
            self.current()['lines'] = new_lines
            if self.selected == hit:
                self.selected = None
            elif self.selected is not None and self.selected > hit:
                self.selected -= 1
            self._redraw()
            return
        line_hit = self._line_near(event.x, event.y)
        if line_hit is not None:
            del lines[line_hit]
            self._redraw()

    def _deselect(self):
        self.selected = None
        self._redraw()

    def _on_hover(self, event):
        fx, fy = self.canvas_to_img(event.x, event.y)
        self.pos_label.config(text='image px: %d, %d   zoom: %.2fx' % (fx, fy, self.view_scale))

    # ---------- drawing ----------
    def _redraw(self):
        crop_x0, crop_y0 = self.view_x, self.view_y
        crop_x1 = self.view_x + CANVAS_W / self.view_scale
        crop_y1 = self.view_y + CANVAS_H / self.view_scale
        crop_x0c, crop_y0c = max(0, crop_x0), max(0, crop_y0)
        crop_x1c = min(self.image.width, crop_x1)
        crop_y1c = min(self.image.height, crop_y1)

        self.canvas.delete('all')
        if crop_x1c > crop_x0c and crop_y1c > crop_y0c:
            region = self.image.crop((int(crop_x0c), int(crop_y0c), int(crop_x1c), int(crop_y1c)))
            disp_w = max(1, int((crop_x1c - crop_x0c) * self.view_scale))
            disp_h = max(1, int((crop_y1c - crop_y0c) * self.view_scale))
            region = region.resize((disp_w, disp_h), Image.LANCZOS)
            self.photo = ImageTk.PhotoImage(region)
            ox, oy = self.img_to_canvas(crop_x0c, crop_y0c)
            self.canvas.create_image(ox, oy, anchor='nw', image=self.photo)

        stars = self.current()['stars']
        lines = self.current()['lines']

        for a, b in lines:
            if a >= len(stars) or b >= len(stars):
                continue
            ax, ay = self.img_to_canvas(stars[a]['x'], stars[a]['y'])
            bx, by = self.img_to_canvas(stars[b]['x'], stars[b]['y'])
            self.canvas.create_line(ax, ay, bx, by, fill='#c9a24a', width=2)

        for i, s in enumerate(stars):
            cx, cy = self.img_to_canvas(s['x'], s['y'])
            color = '#ff5555' if i == self.selected else '#f3d38a'
            self.canvas.create_oval(cx - POINT_R, cy - POINT_R, cx + POINT_R, cy + POINT_R,
                                     fill=color, outline='#1c1912', width=1)
            self.canvas.create_text(cx + POINT_R + 4, cy - POINT_R - 4, text=str(i),
                                     fill='#ece6d6', font=('Consolas', 9), anchor='sw')

    # ---------- save ----------
    def save_all(self):
        try:
            with open(DATA_PATH, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
            self.status_label.config(
                text='Saved %d constellations to content/constellations.json' % len(self.data['constellations'])
            )
        except Exception as e:
            messagebox.showerror('Save failed', str(e))


def main():
    root = tk.Tk()
    ConstellationEditor(root)
    root.mainloop()


if __name__ == '__main__':
    main()
