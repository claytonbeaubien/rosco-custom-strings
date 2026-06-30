#!/usr/bin/env python3
"""
build_tuning_pdf.py - regenerate Rosco_Tuning_Reference.pdf from index.html PACKS.

Customer-facing reference of every tuning the pack builder supports. Published
on roscoguitars.com as a free download. Keep this in sync with the PACKS data
inside index.html - when a tuning is added or removed there, update the
SECTIONS list below and rerun this script.

Run:
    python3 build_tuning_pdf.py

Output: Rosco_Tuning_Reference.pdf (next to this file).
"""

from __future__ import annotations
import json
import os
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, KeepTogether, Frame, PageTemplate, BaseDocTemplate,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# ──────────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────────
HERE   = Path(__file__).resolve().parent
INDEX  = HERE / 'index.html'
LOGO   = HERE / 'data' / 'Rosco Guitars Logo.png'
OUTPUT = HERE / 'Rosco_Tuning_Reference.pdf'

# ──────────────────────────────────────────────────────────────────────────
# Section / tuning order definitions
#
# Each section lists the tunings to display in the order they should appear in
# the customer-facing reference. Names must match the `tuning` field used in
# PACKS inside index.html. Hidden Gems are separate sub-tables.
# ──────────────────────────────────────────────────────────────────────────
SECTIONS = [
    dict(
        title='6-String Guitar',
        string_count=6,
        color='#2cd5c4',            # teal
        subtitle='{n} STANDARD TUNINGS · {h} HIDDEN GEMS',
        blurb=('Standard tunings run from E down to F#. Drop tunings lower the 6th string '
               'an additional whole step from the corresponding standard. Open C is our '
               'alternate tuning, used for slide work and open-chord rhythm.'),
        tunings=['E Standard','Drop D','D# Standard','Drop C#','D Standard','Drop C',
                 'C# Standard','Drop B','C Standard','Drop A#','B Standard','Drop A',
                 'A# Standard','Drop G#','A Standard','Drop G','G# Standard','Drop F#',
                 'G Standard','Drop F','Open C'],
        hidden_gems=['The Idiofame','The Wax Wing','The Holcomb','The Labrynthian'],
    ),
    dict(
        title='7-String Guitar',
        string_count=7,
        color='#7d5fa7',            # purple
        subtitle='{n} STANDARD TUNINGS · {h} HIDDEN GEMS',
        blurb=('Every 7-string standard follows the "B Standard shifted" pattern. Drop '
               'variants lower the 7th string a whole step from the corresponding standard.'),
        tunings=['B Standard','Drop A','A# Standard','Drop G#','A Standard','Drop G',
                 'G# Standard','Drop F#','G Standard','Drop F','F# Standard','Drop E'],
        hidden_gems=['The Stringer','The Thall-O-Caster','The Heavy North'],
    ),
    dict(
        title='8-String Guitar',
        string_count=8,
        color='#3d6ea3',            # blue
        subtitle='{n} STANDARD TUNINGS · {h} HIDDEN GEMS',
        blurb=('Extended-range options including Meshuggah F (identical pitches to F '
               'Standard, named for its most famous user) and Double Drop E (High A) - '
               'a 7-string Drop F# with a High A added on top.'),
        tunings=['F# Standard','F Standard','Meshuggah F','Drop E','Double Drop E (High A)',
                 'A Standard','Drop D','Drop Eb','Drop F','E Standard','High A'],
        hidden_gems=['Tsunami Sea','The Sleep Token'],
    ),
    dict(
        title='4-String Bass',
        string_count=4,
        color='#4ca97d',            # green
        subtitle='{n} TUNINGS · STANDARD AND DROP',
        blurb='The classic 4-string bass range, from E Standard down to Drop B.',
        tunings=['E Standard','Drop D','Eb Standard','D Standard','Drop C',
                 'C Standard','C# Standard','Drop B','B Standard'],
        hidden_gems=[],
    ),
    dict(
        title='5-String Bass',
        string_count=5,
        color='#b59351',            # tan/gold
        subtitle='{n} TUNINGS · LOW-B / HIGH-C CONFIGURATIONS',
        blurb=('Both classic low-B 5-string (B Standard) and the High-C variant (E2 '
               'through C3, used in jazz and modern fusion). Includes Drop F and Drop F# '
               'for ultra-low extended-range work.'),
        tunings=['B Standard','Drop B','Drop A','A Standard','Drop G#','Drop G',
                 'Drop F#','Drop F','High C','E Standard','Drop D','Eb Standard','D Standard'],
        hidden_gems=[],
    ),
]

# ──────────────────────────────────────────────────────────────────────────
# Pull PACKS data out of index.html
# ──────────────────────────────────────────────────────────────────────────
def load_packs() -> dict:
    """Read index.html, locate the `const PACKS = {...};` line, return dict."""
    with INDEX.open(encoding='utf-8') as f:
        for line in f:
            if line.lstrip().startswith('const PACKS = {'):
                m = re.match(r'^const PACKS = (\{.*\});\s*$', line)
                if not m:
                    raise RuntimeError('PACKS line found but did not match expected shape')
                return json.loads(m.group(1))
    raise RuntimeError('PACKS line not found in index.html')


# Note normalization for display - strip "0" sub-octave clutter? No, the
# customer-facing PDF keeps octave numbers. Just pass through.
def notes_low_to_high(pack: dict) -> list[str]:
    """Return the pack's notes in low→high order (s5 → s1)."""
    sorted_strings = sorted(pack['strings'], key=lambda s: -s['string_num'])
    return [s['note'] for s in sorted_strings]


def find_pack(packs: dict, tuning: str, string_count: int) -> dict | None:
    """Find any pack matching the tuning + string count (scale doesn't matter for note display)."""
    for k, p in packs.items():
        if p['tuning'] == tuning and p['string_count'] == string_count:
            return p
    return None


# ──────────────────────────────────────────────────────────────────────────
# Styles
# ──────────────────────────────────────────────────────────────────────────
TEAL       = HexColor('#2cd5c4')
TEXT_DARK  = HexColor('#1a1a1a')
TEXT_GRAY  = HexColor('#667085')
TEXT_MUTED = HexColor('#888888')
ROW_ALT    = HexColor('#f5f6f8')
ROW_BORDER = HexColor('#e3e5ea')

styles = getSampleStyleSheet()
H1 = ParagraphStyle('H1', parent=styles['Heading1'], fontName='Helvetica-Bold',
                    fontSize=28, leading=32, textColor=TEXT_DARK, spaceAfter=4)
H2 = ParagraphStyle('H2', parent=styles['Heading2'], fontName='Helvetica-Bold',
                    fontSize=15, leading=18, textColor=TEXT_DARK, spaceAfter=2)
SUBTITLE = ParagraphStyle('Subtitle', parent=styles['Normal'], fontName='Helvetica-Bold',
                          fontSize=10, leading=12, textColor=TEAL,
                          spaceAfter=10, alignment=TA_LEFT)
BLURB = ParagraphStyle('Blurb', parent=styles['Normal'], fontName='Helvetica',
                       fontSize=10, leading=14, textColor=HexColor('#333333'),
                       spaceAfter=14)
TABLE_HEADER = ParagraphStyle('TH', parent=styles['Normal'], fontName='Helvetica-Bold',
                              fontSize=9, textColor=colors.white,
                              alignment=TA_LEFT, leading=12)
TUNING_NAME = ParagraphStyle('TN', parent=styles['Normal'], fontName='Helvetica-Bold',
                             fontSize=9, textColor=TEXT_DARK, leading=11)
TUNING_NOTES = ParagraphStyle('TNotes', parent=styles['Normal'], fontName='Helvetica',
                              fontSize=9, textColor=HexColor('#444444'), leading=11)


# ──────────────────────────────────────────────────────────────────────────
# Page chrome - header / footer drawn directly on canvas
# ──────────────────────────────────────────────────────────────────────────
def draw_section_chrome(c: canvas.Canvas, doc, *, page_num: int):
    """Header bar at top with small logo and right-aligned 'ROSCO TUNING REFERENCE' /
    roscoguitars.com. Slim footer bar with page numbering."""
    w, h = LETTER
    # Top accent bar
    c.setFillColor(TEAL)
    c.rect(0, h - 0.35*inch, w, 0.35*inch, stroke=0, fill=1)
    # Small logo, top-left, inside the bar
    if LOGO.exists():
        try:
            from reportlab.lib.utils import ImageReader
            img = ImageReader(str(LOGO))
            # Place a small white-on-teal version. The logo asset is white-on-transparent.
            c.drawImage(img, 0.5*inch, h - 0.30*inch,
                        width=0.5*inch, height=0.25*inch,
                        preserveAspectRatio=True, mask='auto')
        except Exception:
            pass
    # Right-aligned header text
    c.setFillColor(colors.white)
    c.setFont('Helvetica-Bold', 9)
    c.drawRightString(w - 0.6*inch, h - 0.18*inch, 'ROSCO TUNING REFERENCE')
    c.setFont('Helvetica', 8)
    c.drawRightString(w - 0.6*inch, h - 0.30*inch, 'roscoguitars.com')
    # Bottom footer
    c.setFillColor(TEAL)
    c.rect(0, 0, w, 0.18*inch, stroke=0, fill=1)
    c.setFillColor(TEXT_GRAY)
    c.setFont('Helvetica', 8)
    c.drawCentredString(w/2, 0.30*inch,
        f'Rosco Guitars Ltd · Vernon, BC · Page {page_num}')


# ──────────────────────────────────────────────────────────────────────────
# Cover page
# ──────────────────────────────────────────────────────────────────────────
def draw_cover(c: canvas.Canvas, counts: dict[str, int]):
    """Solid teal hero with logo and 'TUNING REFERENCE' subtitle, then a white panel
    below with the document title and a row of count cards."""
    w, h = LETTER
    # Teal hero, top half
    hero_h = h * 0.45
    c.setFillColor(TEAL)
    c.rect(0, h - hero_h, w, hero_h, stroke=0, fill=1)
    # Logo centred in hero
    if LOGO.exists():
        try:
            from reportlab.lib.utils import ImageReader
            img = ImageReader(str(LOGO))
            logo_w = 2.3*inch
            logo_h = 1.4*inch
            c.drawImage(img, (w - logo_w)/2, h - hero_h*0.6,
                        width=logo_w, height=logo_h,
                        preserveAspectRatio=True, mask='auto')
        except Exception:
            pass
    # "T U N I N G  R E F E R E N C E" subtitle
    c.setFillColor(colors.white)
    c.setFont('Helvetica-Bold', 11)
    c.drawCentredString(w/2, h - hero_h + 0.6*inch, 'T U N I N G   R E F E R E N C E')

    # Document title on white
    c.setFillColor(TEXT_DARK)
    c.setFont('Helvetica-Bold', 36)
    title_y = h - hero_h - 0.9*inch
    c.drawCentredString(w/2, title_y, 'Every Supported Tuning')

    c.setFillColor(TEXT_GRAY)
    c.setFont('Helvetica', 13)
    c.drawCentredString(w/2, title_y - 0.35*inch, 'For Rosco Custom Strings')

    # Blurb paragraph - two lines centred
    c.setFillColor(HexColor('#444444'))
    c.setFont('Helvetica', 10.5)
    blurb_lines = [
        'A complete reference of every tuning our pack builder supports, across 6-, 7-, and 8-string guitars,',
        'and 4- and 5-string basses. Every set is auto-balanced to the Rosco Progressive Tension Ladder.'
    ]
    c.drawCentredString(w/2, title_y - 0.85*inch, blurb_lines[0])
    c.drawCentredString(w/2, title_y - 1.05*inch, blurb_lines[1])

    # Count cards row
    card_y = title_y - 2.2*inch
    section_count_y = card_y + 0.35*inch
    card_labels = [
        ('6-STRING', counts.get(6, 0)),
        ('7-STRING', counts.get(7, 0)),
        ('8-STRING', counts.get(8, 0)),
        ('4-BASS',   counts.get(4, 0)),
        ('5-BASS',   counts.get(5, 0)),
    ]
    n_cards = len(card_labels)
    inner_w = w - 2.5*inch
    col_w = inner_w / n_cards
    # Top + bottom dividers
    c.setStrokeColor(TEAL)
    c.setLineWidth(1)
    c.line(1.25*inch, section_count_y + 0.55*inch, w - 1.25*inch, section_count_y + 0.55*inch)
    c.line(1.25*inch, section_count_y - 0.40*inch, w - 1.25*inch, section_count_y - 0.40*inch)

    for i, (label, count) in enumerate(card_labels):
        cx = 1.25*inch + col_w * (i + 0.5)
        c.setFillColor(TEXT_GRAY)
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(cx, section_count_y + 0.30*inch, label)
        c.setFillColor(TEAL)
        c.setFont('Helvetica-Bold', 26)
        c.drawCentredString(cx, section_count_y - 0.05*inch, str(count))
        c.setFillColor(TEXT_GRAY)
        c.setFont('Helvetica-Bold', 7)
        c.drawCentredString(cx, section_count_y - 0.22*inch, 'TUNINGS')

    # Footer
    c.setFillColor(TEXT_GRAY)
    c.setFont('Helvetica', 9)
    c.drawCentredString(w/2, 0.9*inch, 'Rosco Guitars Ltd · Vernon, BC, Canada · roscoguitars.com')


# ──────────────────────────────────────────────────────────────────────────
# Section page rendering
# ──────────────────────────────────────────────────────────────────────────
def build_tuning_table(rows: list[tuple[str, list[str]]], color: HexColor) -> Table:
    """rows: list of (tuning_name, [notes low→high])"""
    table_data = [
        [Paragraph('TUNING', TABLE_HEADER), Paragraph('NOTES (LOW → HIGH)', TABLE_HEADER)]
    ]
    for tuning, notes in rows:
        table_data.append([
            Paragraph(tuning, TUNING_NAME),
            Paragraph('  '.join(notes), TUNING_NOTES),
        ])
    t = Table(table_data, colWidths=[1.8*inch, 4.8*inch], repeatRows=1)
    style = TableStyle([
        ('BACKGROUND', (0,0), (-1,0), color),
        ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
        ('VALIGN',     (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING',(0,0), (-1,-1), 10),
        ('TOPPADDING',  (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0), (-1,-1), 4),
        ('LINEBELOW',  (0,0), (-1,-1), 0.5, ROW_BORDER),
    ])
    # Alternating row backgrounds
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            style.add('BACKGROUND', (0,i), (-1,i), ROW_ALT)
    t.setStyle(style)
    return t


def render_section_flowables(section: dict, packs: dict) -> list:
    """Build the list of flowables for one section (heading + main table + optional hidden-gems table)."""
    out = []
    color = HexColor(section['color'])

    # Title with colored accent rule next to it
    title_table = Table(
        [[Paragraph(section['title'], H1), '']],
        colWidths=[3.2*inch, 0.8*inch]
    )
    title_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
        ('LINEABOVE', (1,0), (1,0), 3, color),
        ('TOPPADDING', (1,0), (1,0), 18),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING',(0,0), (-1,-1), 0),
    ]))
    out.append(title_table)

    # Coloured subtitle
    subtitle_style = ParagraphStyle('STitle', parent=SUBTITLE, textColor=color)
    n = len(section['tunings'])
    h = len(section['hidden_gems'])
    sub_text = section['subtitle'].format(n=n, h=h)
    out.append(Paragraph(sub_text, subtitle_style))
    out.append(Paragraph(section['blurb'], BLURB))

    # Main table
    rows = []
    for tuning in section['tunings']:
        pack = find_pack(packs, tuning, section['string_count'])
        if not pack:
            print(f'WARN: no pack found for {tuning} {section["string_count"]}-string', file=sys.stderr)
            continue
        rows.append((tuning, notes_low_to_high(pack)))
    out.append(build_tuning_table(rows, color))

    # Hidden gems sub-section - wrap as KeepTogether so heading + table never split
    if section['hidden_gems']:
        gem_subtitle = ParagraphStyle('GemSub', parent=SUBTITLE, textColor=color, fontSize=9)
        gem_rows = []
        for tuning in section['hidden_gems']:
            pack = find_pack(packs, tuning, section['string_count'])
            if not pack:
                print(f'WARN: no pack for hidden gem {tuning}', file=sys.stderr)
                continue
            gem_rows.append((tuning, notes_low_to_high(pack)))
        out.append(KeepTogether([
            Spacer(1, 0.3*inch),
            Paragraph(f'{section["title"]} - Hidden Gems', H2),
            Paragraph(f'{len(section["hidden_gems"])} TUNINGS · ARTIST & CUSTOM CONFIGURATIONS',
                      gem_subtitle),
            Paragraph(
                'Named artist and custom tunings we get asked about often - each one comes '
                'with our full auto-balancing treatment.',
                BLURB,
            ),
            build_tuning_table(gem_rows, color),
        ]))

    out.append(PageBreak())
    return out


# ──────────────────────────────────────────────────────────────────────────
# Final summary page (tension ladder + info boxes)
# ──────────────────────────────────────────────────────────────────────────
def render_summary_flowables() -> list:
    out = []

    # Heading
    summary_h = ParagraphStyle('SummaryH', parent=H2, fontSize=12, textColor=TEAL,
                                spaceAfter=2)
    out.append(Paragraph('THE ROSCO PROGRESSIVE TENSION LADDER', summary_h))
    out.append(Paragraph('Every pack above is auto-balanced to these targets:', BLURB))

    # Guitar ladder
    guitar_header = ['STRING','S1','S2','S3','S4','S5','S6','S7','S8']
    guitar_values = ['GUITAR (lbs)','13.5','14.5','15.5','18.0','19.0','20.0','21.0','22.0']
    t_guitar = Table([guitar_header, guitar_values], colWidths=[1.4*inch] + [0.55*inch]*8)
    t_guitar.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0,0), (-1,0), TEXT_GRAY),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('FONTNAME', (0,1), (-1,1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,1), 10),
        ('FONTNAME', (0,1), (0,1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0,1), (-1,1), TEXT_DARK),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (-1,0), HexColor('#f5f6f8')),
        ('LINEBELOW', (0,1), (-1,1), 0.5, ROW_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    out.append(t_guitar)
    out.append(Spacer(1, 0.18*inch))

    # Bass ladder
    bass_header = ['STRING','S1','S2','S3','S4','S5','','','']
    bass_values = ['BASS (lbs)','32.0','34.0','36.0','38.0','40.0','','','']
    t_bass = Table([bass_header, bass_values], colWidths=[1.4*inch] + [0.55*inch]*8)
    t_bass.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0,0), (-1,0), TEXT_GRAY),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('FONTNAME', (0,1), (-1,1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,1), 10),
        ('FONTNAME', (0,1), (0,1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0,1), (-1,1), TEXT_DARK),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (5,0), HexColor('#f5f6f8')),
        ('LINEBELOW', (0,1), (5,1), 0.5, ROW_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    out.append(t_bass)

    out.append(Spacer(1, 0.45*inch))

    # Two info boxes side by side
    enharmonic_text = (
        '<b>Enharmonic Names</b><br/><br/>'
        'Tunings with sharp/flat equivalents (D# = Eb, G# = Ab) appear under both '
        'names so you can find the one you think in. The note sequences are identical.'
    )
    custom_text = (
        '<b>Custom Tuning Not Listed?</b><br/><br/>'
        'Contact Rosco directly. Our builder supports any note from C0 to A4, across '
        '24.75"–33" guitar scales and 30"–36" bass scales. We can spec any valid '
        'configuration.'
    )
    box_style = ParagraphStyle('Box', parent=styles['Normal'], fontName='Helvetica',
                                fontSize=9.5, leading=13, textColor=TEXT_DARK)
    info_table = Table(
        [[Paragraph(enharmonic_text, box_style), Paragraph(custom_text, box_style)]],
        colWidths=[3.2*inch, 3.2*inch],
    )
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), HexColor('#e6faf6')),
        ('BACKGROUND', (1,0), (1,0), HexColor('#fff5e0')),
        ('LINEABOVE', (0,0), (0,0), 2, TEAL),
        ('LINEABOVE', (1,0), (1,0), 2, HexColor('#e8a93a')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING',(0,0), (-1,-1), 14),
        ('TOPPADDING',  (0,0), (-1,-1), 14),
        ('BOTTOMPADDING',(0,0), (-1,-1), 14),
    ]))
    out.append(info_table)
    return out


# ──────────────────────────────────────────────────────────────────────────
# Document driver - DIY layout because we want a custom cover page
# ──────────────────────────────────────────────────────────────────────────
class TuningPDF(BaseDocTemplate):
    """Custom doc template: first page is the cover (no chrome), subsequent
    pages get the standard header/footer chrome."""
    def __init__(self, filename, counts):
        super().__init__(filename, pagesize=LETTER,
                         leftMargin=0.6*inch, rightMargin=0.6*inch,
                         topMargin=0.85*inch, bottomMargin=0.6*inch,
                         title='Rosco Tuning Reference',
                         author='Rosco Guitars Ltd')
        self.counts = counts
        self._section_pagenum = 0

        # Cover frame fills the page; content for cover is drawn directly on canvas
        cover_frame = Frame(0, 0, *LETTER, id='cover', showBoundary=0)
        cover_template = PageTemplate(id='cover', frames=[cover_frame],
                                      onPage=self._draw_cover)
        body_frame = Frame(self.leftMargin, self.bottomMargin,
                           self.width, self.height,
                           id='body', showBoundary=0)
        body_template = PageTemplate(id='body', frames=[body_frame],
                                     onPage=self._draw_section_chrome)
        self.addPageTemplates([cover_template, body_template])

    def _draw_cover(self, c, doc):
        draw_cover(c, self.counts)

    def _draw_section_chrome(self, c, doc):
        self._section_pagenum += 1
        draw_section_chrome(c, doc, page_num=self._section_pagenum)


def main():
    if not INDEX.exists():
        sys.exit(f'index.html not found at {INDEX}')
    packs = load_packs()

    counts = {sec['string_count']: len(sec['tunings']) + len(sec['hidden_gems'])
              for sec in SECTIONS}

    doc = TuningPDF(str(OUTPUT), counts)
    story = []
    # First page is cover (already drawn in onPage callback) - but reportlab still
    # needs a flowable. PageBreak after a zero-height spacer.
    story.append(Spacer(1, 0.01))
    story.append(PageBreak())
    # Switch to body template
    from reportlab.platypus import NextPageTemplate
    story.insert(1, NextPageTemplate('body'))

    for section in SECTIONS:
        story.extend(render_section_flowables(section, packs))

    # Last page - summary
    story.extend(render_summary_flowables())

    doc.build(story)
    print(f'Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)')


if __name__ == '__main__':
    main()
t_size:,} bytes)')


if __name__ == '__main__':
    main()
