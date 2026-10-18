using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

#if !UNINSTALLER
using System.IO.Compression;
#endif

namespace Cypher.Setup
{
    internal static class SetupMetadata
    {
        public const string Version = "__CYPHER_VERSION__";
        public const string TermsVersion = "2026-10-18";
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            // The updater may launch Setup while its inherited working directory is
            // inside the installation. Release that directory handle before replacing it.
            try { Environment.CurrentDirectory = Path.GetTempPath(); } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
#if UNINSTALLER
            int render = Array.FindIndex(args, arg => string.Equals(arg, "--render-page", StringComparison.OrdinalIgnoreCase));
            if (render >= 0 && render + 1 < args.Length)
            {
                // Development helper: draws the window to a PNG without removing anything.
                using (var window = new UninstallerWindow { StartPosition = FormStartPosition.Manual, Location = new Point(-4000, -4000), ShowInTaskbar = false })
                using (var bitmap = new Bitmap(window.Width, window.Height))
                {
                    window.Show(); Application.DoEvents();
                    window.DrawToBitmap(bitmap, new Rectangle(0, 0, window.Width, window.Height));
                    bitmap.Save(args[render + 1], ImageFormat.Png);
                }
                return;
            }
            Application.Run(new UninstallerWindow());
#else
            var options = SetupOptions.Parse(args);
            if (!string.IsNullOrEmpty(options.RenderPagesTo))
            {
                SetupWindow.RenderPages(options);
                return;
            }
            if (options.Silent)
            {
                try { SetupEngine.Install(options, delegate { }); }
                catch (Exception ex)
                {
                    if (!options.SilentQuiet) MessageBox.Show(ex.Message, "Cypher Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    Environment.ExitCode = 1;
                    return;
                }
                return;
            }
            Application.Run(new SetupWindow(options));
#endif
        }
    }

    internal static class CypherStyle
    {
        public static readonly Color Background = Color.FromArgb(10, 9, 8);
        public static readonly Color Surface = Color.FromArgb(21, 19, 16);
        public static readonly Color Raised = Color.FromArgb(31, 28, 24);
        public static readonly Color Line = Color.FromArgb(46, 42, 37);
        public static readonly Color Accent = Color.FromArgb(255, 84, 54);
        public static readonly Color AccentDeep = Color.FromArgb(214, 60, 34);
        public static readonly Color Text = Color.FromArgb(236, 230, 216);
        public static readonly Color Muted = Color.FromArgb(165, 158, 144);
        public static readonly Color Faint = Color.FromArgb(110, 104, 94);
        public static readonly Color Good = Color.FromArgb(155, 227, 166);
        public static readonly Color Warning = Color.FromArgb(255, 176, 46);

        private static string displayFamily;
        private static string DisplayFamily
        {
            get
            {
                if (displayFamily != null) return displayFamily;
                string[] candidates = { "Bahnschrift SemiBold Condensed", "Bahnschrift Condensed", "Bahnschrift", "Segoe UI Semibold" };
                using (var fonts = new InstalledFontCollection())
                {
                    var names = new HashSet<string>(fonts.Families.Select(family => family.Name), StringComparer.OrdinalIgnoreCase);
                    displayFamily = candidates.FirstOrDefault(names.Contains) ?? "Segoe UI";
                }
                return displayFamily;
            }
        }

        public static Font Display(float size) { return new Font(DisplayFamily, size, FontStyle.Regular, GraphicsUnit.Point); }
        public static Font Body(float size) { return new Font("Segoe UI", size, FontStyle.Regular, GraphicsUnit.Point); }
        public static Font BodyStrong(float size) { return new Font("Segoe UI", size, FontStyle.Bold, GraphicsUnit.Point); }

        /// <summary>A rectangle with the Recorte cut: top-left and bottom-right corners chamfered.</summary>
        public static GraphicsPath Cut(RectangleF rect, float cut)
        {
            var path = new GraphicsPath();
            path.AddPolygon(new[] {
                new PointF(rect.Left + cut, rect.Top), new PointF(rect.Right, rect.Top), new PointF(rect.Right, rect.Bottom - cut),
                new PointF(rect.Right - cut, rect.Bottom), new PointF(rect.Left, rect.Bottom), new PointF(rect.Left, rect.Top + cut)
            });
            return path;
        }

        /// <summary>A parallelogram, used for primary buttons and progress segments.</summary>
        public static GraphicsPath Slant(RectangleF rect, float slant)
        {
            var path = new GraphicsPath();
            path.AddPolygon(new[] { new PointF(rect.Left + slant, rect.Top), new PointF(rect.Right, rect.Top), new PointF(rect.Right - slant, rect.Bottom), new PointF(rect.Left, rect.Bottom) });
            return path;
        }

        public static void DrawMark(Graphics graphics, RectangleF rect, Color color)
        {
            float x = rect.X, y = rect.Y, w = rect.Width, h = rect.Height;
            PointF[] points = {
                new PointF(x + w * .08f, y + h * .50f), new PointF(x + w * .34f, y + h * .19f),
                new PointF(x + w * .82f, y + h * .19f), new PointF(x + w * .82f, y + h * .34f),
                new PointF(x + w * .42f, y + h * .34f), new PointF(x + w * .26f, y + h * .50f),
                new PointF(x + w * .42f, y + h * .66f), new PointF(x + w * .82f, y + h * .66f),
                new PointF(x + w * .82f, y + h * .81f), new PointF(x + w * .34f, y + h * .81f)
            };
            using (var brush = new SolidBrush(color)) graphics.FillPolygon(brush, points);
            using (var brush = new SolidBrush(Color.FromArgb(110, color)))
                graphics.FillPolygon(brush, new[] { new PointF(x + w * .64f, y + h * .50f), new PointF(x + w * .81f, y + h * .40f), new PointF(x + w * .95f, y + h * .50f) });
        }

        public static void Quality(Graphics g)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        }

        public static void Write(Graphics g, string text, Font font, Color color, RectangleF bounds, StringAlignment align = StringAlignment.Near, StringAlignment lineAlign = StringAlignment.Near)
        {
            using (var brush = new SolidBrush(color))
            using (var format = new StringFormat { Alignment = align, LineAlignment = lineAlign, Trimming = StringTrimming.EllipsisCharacter })
                g.DrawString(text, font, brush, bounds, format);
        }
    }

    internal class Canvas : Control
    {
        public Canvas()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor, true);
            BackColor = Color.Transparent;
        }
    }

    internal sealed class CutButton : Canvas
    {
        public enum Kind { Primary, Secondary, Ghost }
        public Kind Style = Kind.Secondary;
        private bool hovered, pressed;
        public CutButton() { Cursor = Cursors.Hand; TabStop = true; Size = new Size(140, 44); }
        protected override void OnMouseEnter(EventArgs e) { hovered = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { hovered = false; pressed = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnMouseDown(MouseEventArgs e) { pressed = true; Invalidate(); base.OnMouseDown(e); }
        protected override void OnMouseUp(MouseEventArgs e) { pressed = false; Invalidate(); base.OnMouseUp(e); }
        protected override void OnEnabledChanged(EventArgs e) { Cursor = Enabled ? Cursors.Hand : Cursors.Default; Invalidate(); base.OnEnabledChanged(e); }
        protected override void OnGotFocus(EventArgs e) { Invalidate(); base.OnGotFocus(e); }
        protected override void OnLostFocus(EventArgs e) { Invalidate(); base.OnLostFocus(e); }
        protected override void OnKeyDown(KeyEventArgs e) { if (e.KeyCode == Keys.Enter || e.KeyCode == Keys.Space) OnClick(EventArgs.Empty); base.OnKeyDown(e); }
        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics; CypherStyle.Quality(g);
            var rect = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            float offset = pressed ? 1 : 0;
            rect.Offset(0, offset);
            Color fill = Style == Kind.Primary ? (hovered ? Color.FromArgb(255, 112, 84) : CypherStyle.Accent) : Style == Kind.Secondary ? (hovered ? CypherStyle.Raised : CypherStyle.Surface) : Color.Transparent;
            Color text = Style == Kind.Primary ? CypherStyle.Background : (Style == Kind.Ghost && hovered ? CypherStyle.Text : Style == Kind.Ghost ? CypherStyle.Muted : CypherStyle.Text);
            if (!Enabled) { fill = Style == Kind.Primary ? Color.FromArgb(70, CypherStyle.Accent) : fill; text = CypherStyle.Faint; }
            using (var path = Style == Kind.Primary ? CypherStyle.Slant(rect, 12) : CypherStyle.Cut(rect, 9))
            {
                if (fill.A > 0) using (var brush = new SolidBrush(fill)) g.FillPath(brush, path);
                if (Style == Kind.Secondary) using (var pen = new Pen(CypherStyle.Line)) g.DrawPath(pen, path);
                if (Focused && ShowFocusCues) using (var pen = new Pen(CypherStyle.Text, 1.5f) { DashStyle = DashStyle.Dot }) g.DrawPath(pen, path);
            }
            using (var font = CypherStyle.Display(13.5f)) CypherStyle.Write(g, Text.ToUpperInvariant(), font, text, rect, StringAlignment.Center, StringAlignment.Center);
        }
    }

    internal sealed class ToggleRow : Canvas
    {
        public string Title = "", Detail = "";
        private bool on, hovered;
        public event EventHandler Changed;
        public bool Checked { get { return on; } set { on = value; Invalidate(); } }
        public ToggleRow() { Cursor = Cursors.Hand; TabStop = true; Height = 68; }
        protected override void OnMouseEnter(EventArgs e) { hovered = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { hovered = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnClick(EventArgs e) { Toggle(); base.OnClick(e); }
        protected override void OnKeyDown(KeyEventArgs e) { if (e.KeyCode == Keys.Space || e.KeyCode == Keys.Enter) Toggle(); base.OnKeyDown(e); }
        protected override void OnGotFocus(EventArgs e) { Invalidate(); base.OnGotFocus(e); }
        protected override void OnLostFocus(EventArgs e) { Invalidate(); base.OnLostFocus(e); }
        private void Toggle() { on = !on; Invalidate(); if (Changed != null) Changed(this, EventArgs.Empty); }
        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics; CypherStyle.Quality(g);
            var rect = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            using (var path = CypherStyle.Cut(rect, 10))
            {
                using (var brush = new SolidBrush(hovered ? CypherStyle.Raised : CypherStyle.Surface)) g.FillPath(brush, path);
                using (var pen = new Pen(on ? Color.FromArgb(90, CypherStyle.Accent) : CypherStyle.Line)) g.DrawPath(pen, path);
                if (Focused && ShowFocusCues) using (var pen = new Pen(CypherStyle.Text, 1.5f) { DashStyle = DashStyle.Dot }) g.DrawPath(pen, path);
            }
            using (var font = CypherStyle.BodyStrong(10.5f)) CypherStyle.Write(g, Title, font, CypherStyle.Text, new RectangleF(18, 12, Width - 110, 22));
            using (var font = CypherStyle.Body(8.8f)) CypherStyle.Write(g, Detail, font, CypherStyle.Muted, new RectangleF(18, 34, Width - 110, Height - 38));
            var track = new RectangleF(Width - 70, Height / 2f - 12, 46, 24);
            using (var path = CypherStyle.Slant(track, 6)) using (var brush = new SolidBrush(on ? CypherStyle.Accent : CypherStyle.Line)) g.FillPath(brush, path);
            var knob = new RectangleF(on ? track.Right - 22 : track.Left + 6, track.Top + 4, 16, 16);
            using (var path = CypherStyle.Slant(knob, 4)) using (var brush = new SolidBrush(on ? CypherStyle.Background : CypherStyle.Muted)) g.FillPath(brush, path);
        }
    }

    internal sealed class CheckRow : Canvas
    {
        private bool on;
        public event EventHandler Changed;
        public bool Checked { get { return on; } set { on = value; Invalidate(); } }
        public CheckRow() { Cursor = Cursors.Hand; TabStop = true; Height = 30; }
        protected override void OnClick(EventArgs e) { Toggle(); base.OnClick(e); }
        protected override void OnKeyDown(KeyEventArgs e) { if (e.KeyCode == Keys.Space || e.KeyCode == Keys.Enter) Toggle(); base.OnKeyDown(e); }
        protected override void OnGotFocus(EventArgs e) { Invalidate(); base.OnGotFocus(e); }
        protected override void OnLostFocus(EventArgs e) { Invalidate(); base.OnLostFocus(e); }
        private void Toggle() { on = !on; Invalidate(); if (Changed != null) Changed(this, EventArgs.Empty); }
        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics; CypherStyle.Quality(g);
            var box = new RectangleF(1, Height / 2f - 10, 20, 20);
            using (var path = CypherStyle.Cut(box, 5))
            {
                using (var brush = new SolidBrush(on ? CypherStyle.Accent : CypherStyle.Surface)) g.FillPath(brush, path);
                using (var pen = new Pen(on ? CypherStyle.Accent : CypherStyle.Muted, 1.2f)) g.DrawPath(pen, path);
            }
            if (on) using (var pen = new Pen(CypherStyle.Background, 2.4f) { StartCap = LineCap.Round, EndCap = LineCap.Round }) g.DrawLines(pen, new[] { new PointF(box.X + 5, box.Y + 10.5f), new PointF(box.X + 8.6f, box.Y + 14), new PointF(box.X + 15.5f, box.Y + 6.5f) });
            using (var font = CypherStyle.BodyStrong(10)) CypherStyle.Write(g, Text, font, CypherStyle.Text, new RectangleF(32, 0, Width - 34, Height), StringAlignment.Near, StringAlignment.Center);
            if (Focused && ShowFocusCues) using (var pen = new Pen(CypherStyle.Text) { DashStyle = DashStyle.Dot }) g.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
        }
    }

    /// <summary>A scrollable, custom-drawn text view for the terms of use.</summary>
    internal sealed class TermsView : Canvas
    {
        private string body = "";
        private float offset, contentHeight;
        public bool ReachedEnd { get; private set; }
        public event EventHandler ScrolledToEnd;
        public TermsView() { TabStop = true; }
        public string Body { get { return body; } set { body = value ?? ""; offset = 0; Measure(); Invalidate(); } }
        private IEnumerable<string> Paragraphs { get { return body.Replace("\r", "").Split('\n'); } }
        private void Measure()
        {
            if (Width <= 0) return;
            contentHeight = 18;
            using (var g = CreateGraphics()) foreach (string paragraph in Paragraphs) contentHeight += ParagraphHeight(g, paragraph);
        }
        private float ParagraphHeight(Graphics g, string paragraph)
        {
            if (paragraph.Trim().Length == 0) return 8;
            using (var font = FontFor(paragraph)) return g.MeasureString(paragraph, font, Width - 52).Height + (IsHeading(paragraph) ? 6 : 2);
        }
        private static bool IsHeading(string paragraph) { string text = paragraph.Trim(); return text.Length > 2 && text.Length < 70 && text == text.ToUpperInvariant() && text.Any(char.IsLetter); }
        private static Font FontFor(string paragraph) { return IsHeading(paragraph) ? CypherStyle.Display(13) : CypherStyle.Body(9.3f); }
        protected override void OnResize(EventArgs e) { Measure(); base.OnResize(e); }
        protected override void OnMouseEnter(EventArgs e) { Focus(); base.OnMouseEnter(e); }
        protected override void OnMouseWheel(MouseEventArgs e) { ScrollBy(-e.Delta / 2f); base.OnMouseWheel(e); }
        protected override bool IsInputKey(Keys keyData) { return keyData == Keys.Down || keyData == Keys.Up || keyData == Keys.PageDown || keyData == Keys.PageUp || base.IsInputKey(keyData); }
        protected override void OnKeyDown(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Down) ScrollBy(40); if (e.KeyCode == Keys.Up) ScrollBy(-40);
            if (e.KeyCode == Keys.PageDown) ScrollBy(Height - 40); if (e.KeyCode == Keys.PageUp) ScrollBy(-(Height - 40));
            base.OnKeyDown(e);
        }
        private void ScrollBy(float amount)
        {
            float max = Math.Max(0, contentHeight - Height + 16);
            offset = Math.Max(0, Math.Min(max, offset + amount));
            if (!ReachedEnd && offset >= max - 4) { ReachedEnd = true; if (ScrolledToEnd != null) ScrolledToEnd(this, EventArgs.Empty); }
            Invalidate();
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics; CypherStyle.Quality(g);
            var frame = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            using (var path = CypherStyle.Cut(frame, 12)) { using (var brush = new SolidBrush(CypherStyle.Surface)) g.FillPath(brush, path); using (var pen = new Pen(CypherStyle.Line)) g.DrawPath(pen, path); }
            g.SetClip(new RectangleF(1, 1, Width - 2, Height - 2));
            float y = 18 - offset;
            foreach (string paragraph in Paragraphs)
            {
                float height = ParagraphHeight(g, paragraph);
                if (y + height > 0 && y < Height && paragraph.Trim().Length > 0)
                    using (var font = FontFor(paragraph)) CypherStyle.Write(g, paragraph, font, IsHeading(paragraph) ? CypherStyle.Accent : CypherStyle.Text, new RectangleF(22, y, Width - 52, height + 4));
                y += height;
            }
            g.ResetClip();
            if (contentHeight > Height)
            {
                float trackHeight = Height - 24, thumb = Math.Max(30, trackHeight * Height / contentHeight);
                float max = Math.Max(1, contentHeight - Height + 16);
                float top = 12 + (trackHeight - thumb) * (offset / max);
                using (var brush = new SolidBrush(CypherStyle.Line)) g.FillRectangle(brush, Width - 12, 12, 3, trackHeight);
                using (var brush = new SolidBrush(CypherStyle.Accent)) g.FillRectangle(brush, Width - 12, top, 3, thumb);
            }
        }
    }

    /// <summary>The feature carousel shown while files are copied.</summary>
    internal sealed class FeatureCarousel : Canvas
    {
        private sealed class Slide { public string Kicker, Title, Body; public Action<Graphics, RectangleF> Art; }
        private readonly List<Slide> slides = new List<Slide>();
        private readonly System.Windows.Forms.Timer advance = new System.Windows.Forms.Timer { Interval = 5200 };
        private readonly System.Windows.Forms.Timer animate = new System.Windows.Forms.Timer { Interval = 15 };
        private int index, previous = -1;
        private float transition = 1;
        private Bitmap fromImage, toImage;

        public FeatureCarousel()
        {
            Cursor = Cursors.Default;
            Add("MODS", "Mude a frequência.", "Pacotes .cyphermod trocam tema, papel de parede, sons, música reativa e até o visual dos sites. Ative vários ao mesmo tempo.", DrawMods);
            Add("MODO EDIÇÃO · CTRL E", "Clique e mude qualquer parte.", "Barra, abas, cortes, cores e fontes: tudo editável direto na interface, com desfazer.", DrawInspector);
            Add("PRIVACIDADE", "Suas rotas, suas regras.", "Bloqueio de anúncios e rastreadores, rotas Tor e I2P, contêineres por aba e um relatório semanal do que foi barrado.", DrawPrivacy);
            Add("TELA DIVIDIDA · CTRL SHIFT D", "Duas páginas, uma janela.", "Compare, leia e escreva lado a lado. Painéis laterais deixam WhatsApp ou Spotify sempre à mão.", DrawSplit);
            Add("PALETA · CTRL SHIFT A", "Tudo a um atalho.", "Encontre abas, favoritos, histórico e ações sem tirar as mãos do teclado.", DrawPalette);
            Add("SUA HOME", "Uma tela para chamar de sua.", "Relógio, notas, foco, tarefas e atalhos que você monta e posiciona como quiser.", DrawHome);
            advance.Tick += delegate { Go(index + 1); };
            animate.Tick += delegate
            {
                transition = Math.Min(1, transition + 0.06f);
                Invalidate();
                if (transition >= 1) { animate.Stop(); DisposeFrames(); }
            };
        }

        private void Add(string kicker, string title, string body, Action<Graphics, RectangleF> art) { slides.Add(new Slide { Kicker = kicker, Title = title, Body = body, Art = art }); }
        public void Start() { advance.Start(); }
        public void Stop() { advance.Stop(); }
        public void Go(int target)
        {
            if (Width <= 0 || Height <= 0) return;
            target = (target % slides.Count + slides.Count) % slides.Count;
            if (target == index && transition >= 1) return;
            DisposeFrames();
            fromImage = Render(index); toImage = Render(target);
            previous = index; index = target; transition = 0;
            animate.Start(); advance.Stop(); advance.Start();
        }
        private void DisposeFrames() { if (fromImage != null) fromImage.Dispose(); if (toImage != null) toImage.Dispose(); fromImage = null; toImage = null; }
        protected override void Dispose(bool disposing) { if (disposing) { advance.Dispose(); animate.Dispose(); DisposeFrames(); } base.Dispose(disposing); }

        private RectangleF DotsArea { get { return new RectangleF(28, Height - 34, slides.Count * 26, 18); } }
        protected override void OnMouseMove(MouseEventArgs e) { Cursor = DotsArea.Contains(e.Location) || e.X > Width - 110 && e.Y > Height - 44 ? Cursors.Hand : Cursors.Default; base.OnMouseMove(e); }
        protected override void OnMouseClick(MouseEventArgs e)
        {
            if (DotsArea.Contains(e.Location)) Go((int)((e.X - DotsArea.X) / 26));
            else if (e.Y > Height - 44 && e.X > Width - 110) Go(e.X > Width - 58 ? index + 1 : index - 1);
            base.OnMouseClick(e);
        }

        private Bitmap Render(int which)
        {
            var bitmap = new Bitmap(Width, Height, PixelFormat.Format32bppPArgb);
            using (var g = Graphics.FromImage(bitmap)) PaintSlide(g, which);
            return bitmap;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics; CypherStyle.Quality(g);
            if (transition < 1 && fromImage != null && toImage != null)
            {
                float t = 1 - (float)Math.Pow(1 - transition, 3);
                DrawFaded(g, fromImage, -40 * t, 1 - t);
                DrawFaded(g, toImage, 40 * (1 - t), t);
            }
            else PaintSlide(g, index);
            DrawControls(g);
        }

        private static void DrawFaded(Graphics g, Image image, float dx, float alpha)
        {
            using (var attributes = new ImageAttributes())
            {
                attributes.SetColorMatrix(new ColorMatrix { Matrix33 = Math.Max(0, Math.Min(1, alpha)) });
                g.DrawImage(image, new Rectangle((int)dx, 0, image.Width, image.Height), 0, 0, image.Width, image.Height, GraphicsUnit.Pixel, attributes);
            }
        }

        private void PaintSlide(Graphics g, int which)
        {
            CypherStyle.Quality(g);
            var slide = slides[which];
            var frame = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            using (var path = CypherStyle.Cut(frame, 18))
            {
                using (var brush = new LinearGradientBrush(frame, Color.FromArgb(26, 23, 20), CypherStyle.Surface, 120f)) g.FillPath(brush, path);
                using (var pen = new Pen(CypherStyle.Line)) g.DrawPath(pen, path);
            }
            using (var brush = new SolidBrush(CypherStyle.Accent)) g.FillPolygon(brush, new[] { new PointF(Width - 1, 0), new PointF(Width - 1, 34), new PointF(Width - 35, 0) });
            float textWidth = Width * 0.5f;
            using (var font = CypherStyle.Display(11)) CypherStyle.Write(g, string.Format("{0:00} / {1:00}  ·  {2}", which + 1, slides.Count, slide.Kicker), font, CypherStyle.Accent, new RectangleF(28, 26, textWidth + 60, 22));
            using (var font = CypherStyle.Display(26)) CypherStyle.Write(g, slide.Title.ToUpperInvariant(), font, CypherStyle.Text, new RectangleF(26, 52, textWidth, 100));
            using (var font = CypherStyle.Body(9.8f)) CypherStyle.Write(g, slide.Body, font, CypherStyle.Muted, new RectangleF(28, 160, textWidth - 10, 100));
            slide.Art(g, new RectangleF(Width * 0.56f, 30, Width * 0.40f, Height - 82));
        }

        private void DrawControls(Graphics g)
        {
            for (int i = 0; i < slides.Count; i++)
            {
                var dot = new RectangleF(DotsArea.X + i * 26, DotsArea.Y + 6, i == index ? 20 : 12, 5);
                using (var path = CypherStyle.Slant(dot, 2)) using (var brush = new SolidBrush(i == index ? CypherStyle.Accent : CypherStyle.Line)) g.FillPath(brush, path);
            }
            using (var font = CypherStyle.Display(16))
            {
                CypherStyle.Write(g, "‹", font, CypherStyle.Muted, new RectangleF(Width - 104, Height - 44, 40, 30), StringAlignment.Center, StringAlignment.Center);
                CypherStyle.Write(g, "›", font, CypherStyle.Muted, new RectangleF(Width - 56, Height - 44, 40, 30), StringAlignment.Center, StringAlignment.Center);
            }
        }

        // ----- Slide illustrations (vector, drawn in code) -----
        private static void Panel(Graphics g, RectangleF rect, Color fill, float cut = 8) { using (var path = CypherStyle.Cut(rect, cut)) { using (var brush = new SolidBrush(fill)) g.FillPath(brush, path); using (var pen = new Pen(Color.FromArgb(60, 255, 255, 255))) g.DrawPath(pen, path); } }
        private static void Bar(Graphics g, float x, float y, float w, float h, Color color) { using (var brush = new SolidBrush(color)) g.FillRectangle(brush, x, y, w, h); }

        private static void DrawMods(Graphics g, RectangleF a)
        {
            var colors = new[] { Color.FromArgb(57, 224, 255), Color.FromArgb(255, 179, 71), CypherStyle.Accent };
            for (int i = 0; i < 3; i++)
            {
                var card = new RectangleF(a.X + i * 34, a.Y + 18 + i * 26, a.Width - 80, a.Height - 110);
                Panel(g, card, Color.FromArgb(14, 13, 12), 12);
                Bar(g, card.X + 14, card.Y + 16, card.Width * 0.45f, 10, colors[i]);
                Bar(g, card.X + 14, card.Y + 34, card.Width * 0.7f, 6, Color.FromArgb(50, 236, 230, 216));
                using (var brush = new SolidBrush(Color.FromArgb(70, colors[i]))) g.FillEllipse(brush, card.Right - 70, card.Bottom - 70, 52, 52);
            }
            using (var pen = new Pen(CypherStyle.Accent, 2)) for (int i = 0; i < 5; i++) g.DrawLine(pen, a.Right - 30 + i * 6, a.Bottom - 20, a.Right - 30 + i * 6, a.Bottom - 20 - (8 + (i * 7) % 18));
        }

        private static void DrawInspector(Graphics g, RectangleF a)
        {
            var window = new RectangleF(a.X, a.Y + 10, a.Width - 10, a.Height - 40);
            Panel(g, window, Color.FromArgb(14, 13, 12), 12);
            var address = new RectangleF(window.X + 40, window.Y + 16, window.Width - 70, 22);
            using (var pen = new Pen(CypherStyle.Accent, 2) { DashStyle = DashStyle.Dash }) g.DrawRectangle(pen, address.X - 4, address.Y - 4, address.Width + 8, address.Height + 8);
            Bar(g, address.X, address.Y, address.Width, address.Height, Color.FromArgb(40, 236, 230, 216));
            for (int i = 0; i < 4; i++) Bar(g, window.X + 14, window.Y + 60 + i * 22, 70, 14, i == 0 ? CypherStyle.Text : Color.FromArgb(40, 236, 230, 216));
            var inspector = new RectangleF(window.Right - 120, window.Y + 54, 104, window.Height - 70);
            Panel(g, inspector, Color.FromArgb(31, 28, 24), 8);
            for (int i = 0; i < 4; i++) { Bar(g, inspector.X + 10, inspector.Y + 14 + i * 26, 84, 4, Color.FromArgb(60, 236, 230, 216)); Bar(g, inspector.X + 10, inspector.Y + 14 + i * 26, 30 + i * 12, 4, CypherStyle.Accent); }
            using (var brush = new SolidBrush(CypherStyle.Text)) g.FillPolygon(brush, new[] { new PointF(address.Right - 30, address.Bottom + 6), new PointF(address.Right - 30, address.Bottom + 28), new PointF(address.Right - 24, address.Bottom + 22), new PointF(address.Right - 18, address.Bottom + 32), new PointF(address.Right - 14, address.Bottom + 30), new PointF(address.Right - 20, address.Bottom + 20), new PointF(address.Right - 12, address.Bottom + 20) });
        }

        private static void DrawPrivacy(Graphics g, RectangleF a)
        {
            float cx = a.X + a.Width / 2, cy = a.Y + a.Height / 2 - 6;
            var shield = new[] { new PointF(cx, cy - 70), new PointF(cx + 58, cy - 46), new PointF(cx + 52, cy + 22), new PointF(cx, cy + 70), new PointF(cx - 52, cy + 22), new PointF(cx - 58, cy - 46) };
            using (var brush = new SolidBrush(Color.FromArgb(40, CypherStyle.Accent))) g.FillPolygon(brush, shield);
            using (var pen = new Pen(CypherStyle.Accent, 2.5f)) g.DrawPolygon(pen, shield);
            using (var pen = new Pen(CypherStyle.Text, 4) { StartCap = LineCap.Round, EndCap = LineCap.Round }) g.DrawLines(pen, new[] { new PointF(cx - 20, cy), new PointF(cx - 4, cy + 16), new PointF(cx + 24, cy - 16) });
            string[] routes = { "NORMAL", "TOR", "I2P" };
            using (var font = CypherStyle.Display(10))
                for (int i = 0; i < 3; i++)
                {
                    var chip = new RectangleF(a.X + 6 + i * (a.Width / 3), a.Bottom - 30, a.Width / 3 - 10, 24);
                    using (var path = CypherStyle.Slant(chip, 6)) using (var brush = new SolidBrush(i == 1 ? CypherStyle.Text : Color.FromArgb(40, 236, 230, 216))) g.FillPath(brush, path);
                    CypherStyle.Write(g, routes[i], font, i == 1 ? CypherStyle.Background : CypherStyle.Muted, chip, StringAlignment.Center, StringAlignment.Center);
                }
        }

        private static void DrawSplit(Graphics g, RectangleF a)
        {
            var window = new RectangleF(a.X, a.Y + 10, a.Width - 10, a.Height - 40);
            Panel(g, window, Color.FromArgb(14, 13, 12), 12);
            float half = window.Width * 0.46f;
            var left = new RectangleF(window.X + 10, window.Y + 16, half - 14, window.Height - 26);
            var right = new RectangleF(window.X + half + 6, window.Y + 16, window.Width - half - 16, window.Height - 26);
            Panel(g, left, Color.FromArgb(236, 230, 216), 6); Panel(g, right, Color.FromArgb(31, 28, 24), 6);
            for (int i = 0; i < 6; i++) { Bar(g, left.X + 10, left.Y + 14 + i * 16, left.Width * (i % 2 == 0 ? 0.8f : 0.6f), 6, Color.FromArgb(70, 10, 9, 8)); Bar(g, right.X + 10, right.Y + 14 + i * 16, right.Width * (i % 3 == 0 ? 0.5f : 0.75f), 6, Color.FromArgb(70, 236, 230, 216)); }
            Bar(g, window.X + half - 2, window.Y + 16, 5, window.Height - 26, CypherStyle.Accent);
        }

        private static void DrawPalette(Graphics g, RectangleF a)
        {
            var box = new RectangleF(a.X + 6, a.Y + 18, a.Width - 20, a.Height - 60);
            Panel(g, box, Color.FromArgb(31, 28, 24), 12);
            Bar(g, box.X, box.Y + 44, box.Width, 1, CypherStyle.Line);
            using (var pen = new Pen(CypherStyle.Accent, 2)) { g.DrawEllipse(pen, box.X + 16, box.Y + 14, 13, 13); g.DrawLine(pen, box.X + 27, box.Y + 26, box.X + 33, box.Y + 32); }
            Bar(g, box.X + 44, box.Y + 19, 120, 6, Color.FromArgb(90, 236, 230, 216));
            for (int i = 0; i < 4; i++)
            {
                float y = box.Y + 58 + i * 30;
                if (i == 0) using (var brush = new SolidBrush(Color.FromArgb(40, CypherStyle.Accent))) g.FillRectangle(brush, box.X + 8, y - 6, box.Width - 16, 26);
                Bar(g, box.X + 18, y, 16, 14, i == 0 ? CypherStyle.Accent : Color.FromArgb(50, 236, 230, 216));
                Bar(g, box.X + 44, y + 4, 90 + (i * 23) % 60, 6, i == 0 ? CypherStyle.Text : Color.FromArgb(70, 236, 230, 216));
            }
        }

        private static void DrawHome(Graphics g, RectangleF a)
        {
            var grid = new[] { new RectangleF(0, 0, 0.62f, 0.34f), new RectangleF(0.66f, 0, 0.34f, 0.34f), new RectangleF(0, 0.39f, 0.40f, 0.61f), new RectangleF(0.44f, 0.39f, 0.56f, 0.28f), new RectangleF(0.44f, 0.72f, 0.56f, 0.28f) };
            float w = a.Width - 10, h = a.Height - 34;
            for (int i = 0; i < grid.Length; i++)
            {
                var cell = new RectangleF(a.X + grid[i].X * w, a.Y + 10 + grid[i].Y * h, grid[i].Width * w, grid[i].Height * h);
                Panel(g, cell, i == 1 ? CypherStyle.Accent : Color.FromArgb(31, 28, 24), 8);
                if (i == 0) { Bar(g, cell.X + 12, cell.Y + 14, cell.Width * 0.6f, 12, CypherStyle.Text); Bar(g, cell.X + 12, cell.Y + 32, cell.Width * 0.4f, 12, CypherStyle.Accent); }
                if (i == 1) using (var font = CypherStyle.Display(20)) CypherStyle.Write(g, "12:00", font, CypherStyle.Background, cell, StringAlignment.Center, StringAlignment.Center);
                if (i == 2) for (int line = 0; line < 4; line++) Bar(g, cell.X + 12, cell.Y + 18 + line * 16, cell.Width * 0.7f, 5, Color.FromArgb(70, 236, 230, 216));
            }
        }
    }

    internal sealed class SetupOptions
    {
        public bool Silent;
        public bool SilentQuiet;
        public bool ForceRun;
        public bool Updated;
        public bool DeferLaunch;
        public int WaitForProcessId;
        public string UpdateNotesBase64 = "";
        public string Target;
        public bool Desktop = true;
        public bool StartMenu = true;
        public bool DefaultBrowser = true;
        public bool ErrorReports;
        public bool TermsAccepted;
        public string RenderPagesTo = "";

        public static SetupOptions Parse(string[] args)
        {
            var result = new SetupOptions();
            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i];
                if (string.Equals(arg, "/S", StringComparison.OrdinalIgnoreCase) || string.Equals(arg, "--silent", StringComparison.OrdinalIgnoreCase)) result.Silent = true;
                if (string.Equals(arg, "--quiet", StringComparison.OrdinalIgnoreCase)) result.SilentQuiet = true;
                if (string.Equals(arg, "--force-run", StringComparison.OrdinalIgnoreCase)) result.ForceRun = true;
                if (string.Equals(arg, "--updated", StringComparison.OrdinalIgnoreCase)) result.Updated = true;
                if (arg.StartsWith("--cypher-update-notes=", StringComparison.OrdinalIgnoreCase))
                {
                    string notes = arg.Substring("--cypher-update-notes=".Length);
                    if (notes.Length <= 5000 && notes.All(character => char.IsLetterOrDigit(character) || character == '-' || character == '_')) result.UpdateNotesBase64 = notes;
                }
                if (string.Equals(arg, "--defer-launch", StringComparison.OrdinalIgnoreCase)) result.DeferLaunch = true;
                if (arg.StartsWith("--wait-for-process=", StringComparison.OrdinalIgnoreCase)) int.TryParse(arg.Substring(19), out result.WaitForProcessId);
                if (string.Equals(arg, "--wait-for-process", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length) int.TryParse(args[++i], out result.WaitForProcessId);
                if (string.Equals(arg, "--no-desktop", StringComparison.OrdinalIgnoreCase)) result.Desktop = false;
                if (string.Equals(arg, "--no-start-menu", StringComparison.OrdinalIgnoreCase)) result.StartMenu = false;
                if (string.Equals(arg, "--error-reports", StringComparison.OrdinalIgnoreCase)) result.ErrorReports = true;
                if (string.Equals(arg, "--accept-terms", StringComparison.OrdinalIgnoreCase)) result.TermsAccepted = true;
                if (arg.StartsWith("--target=", StringComparison.OrdinalIgnoreCase)) result.Target = arg.Substring(9).Trim('"');
                if (string.Equals(arg, "--target", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length) result.Target = args[++i].Trim('"');
                if (string.Equals(arg, "--render-pages", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length) result.RenderPagesTo = args[++i].Trim('"');
            }
            if (string.IsNullOrWhiteSpace(result.Target))
            {
#if !UNINSTALLER
                result.Target = SetupEngine.FindInstallLocation();
#endif
            }
            if (result.Silent)
            {
                result.DefaultBrowser = false;
                try
                {
                    using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Cypher", false))
                    {
                        if (key != null)
                        {
                            result.Desktop = Convert.ToInt32(key.GetValue("CreateDesktopShortcut", 1)) != 0;
                            result.StartMenu = Convert.ToInt32(key.GetValue("CreateStartMenuShortcut", 1)) != 0;
                            if (!result.ErrorReports) result.ErrorReports = Convert.ToInt32(key.GetValue("SendErrorReports", 0)) != 0;
                        }
                    }
                }
                catch { }
            }
            if (args.Any(arg => string.Equals(arg, "--no-desktop", StringComparison.OrdinalIgnoreCase))) result.Desktop = false;
            if (args.Any(arg => string.Equals(arg, "--no-start-menu", StringComparison.OrdinalIgnoreCase))) result.StartMenu = false;
            if (string.IsNullOrWhiteSpace(result.Target)) result.Target = DefaultTarget;
            return result;
        }

        public static string DefaultTarget { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Cypher"); } }
        public static string AllUsersTarget { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Cypher"); } }
    }

#if !UNINSTALLER
    internal static class SetupEngine
    {
        public static string FindInstallLocation()
        {
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Cypher", false))
                {
                    var path = key == null ? null : key.GetValue("InstallLocation") as string;
                    if (!string.IsNullOrWhiteSpace(path) && File.Exists(Path.Combine(path, "Cypher.exe"))) return path;
                }
            }
            catch { }
            foreach (RegistryKey hive in new[] { Registry.CurrentUser, Registry.LocalMachine })
            {
                try
                {
                    using (var root = hive.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall", false))
                    {
                        if (root == null) continue;
                        foreach (string name in root.GetSubKeyNames())
                        {
                            using (var key = root.OpenSubKey(name, false))
                            {
                                string title = key == null ? null : key.GetValue("DisplayName") as string;
                                string location = key == null ? null : key.GetValue("InstallLocation") as string;
                                if (string.Equals(title, "Cypher", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(location) && File.Exists(Path.Combine(location, "Cypher.exe"))) return location;
                            }
                        }
                    }
                }
                catch { }
            }
            return null;
        }

        private static long payloadBytes = -1;
        /// <summary>Total uncompressed size of the embedded browser files.</summary>
        public static long PayloadBytes()
        {
            if (payloadBytes >= 0) return payloadBytes;
            try
            {
                using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("CypherSetup.Payload.zip"))
                {
                    if (resource == null) return payloadBytes = 0;
                    using (var archive = new ZipArchive(resource, ZipArchiveMode.Read)) payloadBytes = archive.Entries.Sum(entry => entry.Length);
                }
            }
            catch { payloadBytes = 0; }
            return payloadBytes;
        }

        public static string TermsText()
        {
            try
            {
                using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("CypherSetup.Terms.txt"))
                {
                    if (resource != null) using (var reader = new StreamReader(resource, Encoding.UTF8)) return reader.ReadToEnd();
                }
            }
            catch { }
            return "Os termos de uso do Cypher estão disponíveis em https://github.com/sCypher-me/cypher-browser";
        }

        public static bool Install(SetupOptions options, Action<int, string> progress)
        {
            string target = Path.GetFullPath(options.Target);
            EnsureValidTarget(target);
            if (NeedsElevation(target) && !IsAdministrator())
            {
                RelaunchElevated(options, target);
                return true;
            }
            WaitForUpdateRequester(options.WaitForProcessId);
            CloseCypher(options.Updated);
            progress(3, "Preparando o pacote verificado do Cypher");

            string parent = Path.GetDirectoryName(target);
            if (string.IsNullOrWhiteSpace(parent)) throw new InvalidOperationException("A pasta escolhida não é válida.");
            Directory.CreateDirectory(parent);
            string staging = target + ".cypher-stage-" + Guid.NewGuid().ToString("N");
            string backup = target + ".cypher-backup-" + Guid.NewGuid().ToString("N");
            bool movedOld = false;
            try
            {
                Directory.CreateDirectory(staging);
                using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("CypherSetup.Payload.zip"))
                {
                    if (resource == null) throw new InvalidOperationException("O pacote de instalação do Cypher não foi incluído.");
                    using (var archive = new ZipArchive(resource, ZipArchiveMode.Read))
                    {
                        var files = archive.Entries.Where(entry => !string.IsNullOrEmpty(entry.Name)).ToArray();
                        if (!files.Any(entry => string.Equals(entry.FullName.Replace('/', '\\'), "Cypher.exe", StringComparison.OrdinalIgnoreCase)))
                            throw new InvalidDataException("O pacote não contém o executável do Cypher.");
                        int completed = 0;
                        foreach (var entry in files)
                        {
                            string relative = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                            string output = Path.GetFullPath(Path.Combine(staging, relative));
                            if (!output.StartsWith(staging.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                                throw new InvalidDataException("O pacote contém um caminho de arquivo inválido.");
                            Directory.CreateDirectory(Path.GetDirectoryName(output));
                            using (var source = entry.Open()) using (var destination = new FileStream(output, FileMode.Create, FileAccess.Write, FileShare.None)) source.CopyTo(destination);
                            completed++;
                            if (completed % 8 == 0 || completed == files.Length)
                                progress(5 + (int)(completed * 82.0 / files.Length), "Copiando arquivos do navegador · " + completed + " de " + files.Length);
                        }
                    }
                }
                if (!File.Exists(Path.Combine(staging, "Cypher.exe"))) throw new InvalidDataException("Não foi possível validar os arquivos instalados.");
                try { File.WriteAllText(Path.Combine(staging, "TERMOS-DE-USO.txt"), TermsText(), Encoding.UTF8); } catch { }
                progress(90, "Registrando o Cypher no Windows");
                if (Directory.Exists(target))
                {
                    if (!File.Exists(Path.Combine(target, "Cypher.exe")) && Directory.EnumerateFileSystemEntries(target).Any())
                        throw new IOException("A pasta escolhida contém arquivos que não pertencem ao Cypher. Escolha uma pasta vazia ou a instalação existente.");
                    MoveDirectoryWithRetry(target, backup, "substituir a instalação anterior");
                    movedOld = true;
                }
                MoveDirectoryWithRetry(staging, target, "ativar os arquivos da nova versão");
                RegisterInstallation(target, options);
                if (movedOld) TryDelete(backup);
            }
            catch (Exception installError)
            {
                TryDelete(staging);
                if (movedOld && Directory.Exists(backup))
                {
                    try
                    {
                        if (Directory.Exists(target))
                        {
                            string failedInstall = target + ".cypher-failed-" + Guid.NewGuid().ToString("N");
                            MoveDirectoryWithRetry(target, failedInstall, "preservar os arquivos da nova versão com falha");
                            TryDelete(failedInstall);
                        }
                        MoveDirectoryWithRetry(backup, target, "restaurar a versão anterior");
                    }
                    catch (Exception rollbackError)
                    {
                        throw new IOException("A instalação não foi concluída e o Cypher não conseguiu restaurar os arquivos automaticamente. A versão anterior foi preservada em: " + backup + ". Detalhes: " + rollbackError.Message, installError);
                    }
                }
                throw;
            }

            // A instalação já está confirmada. Uma falha ao abrir o navegador não deve
            // restaurar a versão antiga depois de a interface mostrar 100%.
            progress(100, "Cypher instalado e registrado");
            if (options.Silent && !options.DeferLaunch && (options.ForceRun || options.Updated))
            {
                try { StartCypherWithRetry(target, options.Updated, options.UpdateNotesBase64); }
                catch (Exception ex)
                {
                    throw new IOException("A atualização foi instalada, mas o Cypher não conseguiu abrir automaticamente. Abra-o pelo atalho do navegador. Detalhes: " + ex.Message, ex);
                }
            }
            return true;
        }

        private static void MoveDirectoryWithRetry(string source, string destination, string operation)
        {
            Exception lastError = null;
            for (int attempt = 0; attempt < 24; attempt++)
            {
                try { Directory.Move(source, destination); return; }
                catch (IOException ex)
                {
                    lastError = ex;
                    if (attempt == 23) break;
                    Thread.Sleep(500);
                }
            }
            throw new IOException("Não foi possível " + operation + " porque um arquivo ainda está em uso. Feche todas as janelas do Cypher e tente novamente. Detalhes: " + (lastError == null ? "erro de acesso aos arquivos" : lastError.Message), lastError);
        }

        private static void StartCypherWithRetry(string target, bool updated, string updateNotesBase64)
        {
            Exception lastError = null;
            for (int attempt = 0; attempt < 8; attempt++)
            {
                try { StartCypher(target, updated, updateNotesBase64); return; }
                catch (IOException ex) { lastError = ex; }
                catch (System.ComponentModel.Win32Exception ex) { lastError = ex; }
                if (attempt < 7) Thread.Sleep(750);
            }
            throw new IOException("O Windows não conseguiu iniciar o executável instalado.", lastError);
        }

        public static void EnsureValidTarget(string target)
        {
            if (string.IsNullOrWhiteSpace(target) || target.Length < 5 || target.IndexOfAny(Path.GetInvalidPathChars()) >= 0)
                throw new InvalidOperationException("Escolha uma pasta de instalação válida.");
            if (!Path.IsPathRooted(target)) throw new InvalidOperationException("Use um caminho completo, começando pela letra do disco.");
            string root = Path.GetPathRoot(target);
            if (string.Equals(target.TrimEnd('\\'), root.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("O Cypher não pode ser instalado na raiz do disco.");
        }

        /// <summary>Checks a target folder and returns a friendly status: empty means OK.</summary>
        public static string DescribeTarget(string target, out bool isUpdate, out long freeBytes)
        {
            isUpdate = false; freeBytes = -1;
            try
            {
                EnsureValidTarget(target);
                string full = Path.GetFullPath(target);
                try { freeBytes = new DriveInfo(Path.GetPathRoot(full)).AvailableFreeSpace; } catch { }
                if (Directory.Exists(full))
                {
                    if (File.Exists(Path.Combine(full, "Cypher.exe"))) isUpdate = true;
                    else if (Directory.EnumerateFileSystemEntries(full).Any()) return "Esta pasta já tem outros arquivos. Escolha uma pasta vazia ou crie uma nova.";
                }
                long needed = PayloadBytes();
                if (freeBytes >= 0 && needed > 0 && freeBytes < needed + 50L * 1024 * 1024) return "Não há espaço livre suficiente neste disco.";
                return "";
            }
            catch (Exception ex) { return ex.Message; }
        }

        public static bool NeedsElevation(string target)
        {
            string[] protectedPaths = { Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), Environment.GetFolderPath(Environment.SpecialFolder.Windows) };
            return protectedPaths.Any(path => !string.IsNullOrWhiteSpace(path) && target.StartsWith(path.TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase));
        }

        private static bool IsAdministrator()
        {
            try { return new System.Security.Principal.WindowsPrincipal(System.Security.Principal.WindowsIdentity.GetCurrent()).IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator); }
            catch { return false; }
        }

        private static void RelaunchElevated(SetupOptions options, string target)
        {
            var info = new ProcessStartInfo(Assembly.GetExecutingAssembly().Location)
            {
                UseShellExecute = true,
                Verb = "runas",
                WorkingDirectory = Path.GetTempPath(),
                Arguments = "/S " + (options.ForceRun ? "--force-run " : "") + (options.Updated ? "--updated " : "") + (options.UpdateNotesBase64.Length > 0 ? "--cypher-update-notes=" + options.UpdateNotesBase64 + " " : "") + (options.WaitForProcessId > 0 ? "--wait-for-process=" + options.WaitForProcessId + " " : "") + (options.Desktop ? "" : "--no-desktop ") + (options.StartMenu ? "" : "--no-start-menu ") + (options.ErrorReports ? "--error-reports " : "") + (options.TermsAccepted ? "--accept-terms " : "") + (!options.Silent ? "--defer-launch " : "") + "--target " + Quote(target)
            };
            try
            {
                using (var elevated = Process.Start(info))
                {
                    if (elevated == null) throw new IOException("O Windows não iniciou o instalador elevado.");
                    elevated.WaitForExit();
                    if (elevated.ExitCode != 0) throw new IOException("A instalação elevada não foi concluída.");
                }
            }
            catch (System.ComponentModel.Win32Exception ex)
            {
                if (ex.NativeErrorCode == 1223) throw new OperationCanceledException("A instalação precisa de permissão do Windows para usar essa pasta.");
                throw;
            }
        }

        private static string Quote(string value) { return "\"" + value.Replace("\"", "\\\"") + "\""; }

        private static void WaitForUpdateRequester(int processId)
        {
            if (processId <= 0 || processId == Process.GetCurrentProcess().Id) return;
            try
            {
                using (var requester = Process.GetProcessById(processId))
                {
                    if (string.Equals(requester.ProcessName, "Cypher", StringComparison.OrdinalIgnoreCase) && !requester.WaitForExit(120000))
                        throw new InvalidOperationException("O Cypher ainda está encerrando para a atualização. Aguarde e tente novamente.");
                }
            }
            catch (ArgumentException) { }
        }

        private static void CloseCypher(bool waitForUpdater)
        {
            var closeRequested = new HashSet<int>();
            DateTime deadline = DateTime.UtcNow.AddSeconds(waitForUpdater ? 120 : 30);
            while (DateTime.UtcNow < deadline)
            {
                bool running = false;
                foreach (var process in Process.GetProcessesByName("Cypher"))
                {
                    using (process)
                    {
                        try
                        {
                            if (process.HasExited) continue;
                            running = true;
                            if (!waitForUpdater && process.MainWindowHandle != IntPtr.Zero && closeRequested.Add(process.Id)) process.CloseMainWindow();
                        }
                        catch { }
                    }
                }
                if (!running) return;
                Thread.Sleep(250);
            }

            var remaining = Process.GetProcessesByName("Cypher");
            bool stillRunning = false;
            foreach (var process in remaining)
            {
                using (process) { try { if (!process.HasExited) stillRunning = true; } catch { } }
            }
            if (stillRunning) throw new InvalidOperationException(waitForUpdater
                ? "O Cypher não encerrou após iniciar a atualização. Feche o navegador manualmente e tente novamente."
                : "O Cypher ainda está finalizando. Feche todas as janelas e tente novamente.");
        }

        private static void RegisterInstallation(string target, SetupOptions options)
        {
            string executable = Path.Combine(target, "Cypher.exe");
            string uninstaller = Path.Combine(target, "CypherUninstaller.exe");
            string openCommand = Quote(executable) + " \"%1\"";
            RemoveLegacyUninstallEntries();
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Cypher"))
            {
                key.SetValue("InstallLocation", target);
                key.SetValue("CreateDesktopShortcut", options.Desktop ? 1 : 0, RegistryValueKind.DWord);
                key.SetValue("CreateStartMenuShortcut", options.StartMenu ? 1 : 0, RegistryValueKind.DWord);
                key.SetValue("SendErrorReports", options.ErrorReports ? 1 : 0, RegistryValueKind.DWord);
                if (options.TermsAccepted)
                {
                    key.SetValue("TermsAcceptedVersion", SetupMetadata.TermsVersion);
                    key.SetValue("TermsAcceptedAt", DateTime.UtcNow.ToString("o"));
                }
            }
            // Link and HTML handlers the Windows default-apps page needs to list Cypher as a browser.
            foreach (string progId in new[] { "CypherURL", "CypherHTML" })
            {
                using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\" + progId))
                {
                    key.SetValue("", progId == "CypherURL" ? "Cypher URL" : "Documento HTML do Cypher");
                    if (progId == "CypherURL") key.SetValue("URL Protocol", "");
                }
                using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\" + progId + @"\DefaultIcon")) key.SetValue("", executable + ",0");
                using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\" + progId + @"\shell\open\command")) key.SetValue("", openCommand);
            }
            foreach (string extension in new[] { ".htm", ".html", ".xhtml", ".svg", ".pdf" })
                using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\" + extension + @"\OpenWithProgids")) key.SetValue("CypherHTML", new byte[0], RegistryValueKind.None);
            const string capabilitiesPath = @"Software\Clients\StartMenuInternet\Cypher\Capabilities";
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Clients\StartMenuInternet\Cypher")) key.SetValue("", "Cypher");
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Clients\StartMenuInternet\Cypher\DefaultIcon")) key.SetValue("", executable + ",0");
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Clients\StartMenuInternet\Cypher\shell\open\command")) key.SetValue("", Quote(executable));
            using (var key = Registry.CurrentUser.CreateSubKey(capabilitiesPath))
            {
                key.SetValue("ApplicationName", "Cypher"); key.SetValue("ApplicationDescription", "Navegador Cypher: privado e personalizável"); key.SetValue("ApplicationIcon", executable + ",0");
            }
            using (var key = Registry.CurrentUser.CreateSubKey(capabilitiesPath + @"\URLAssociations")) { key.SetValue("http", "CypherURL"); key.SetValue("https", "CypherURL"); }
            using (var key = Registry.CurrentUser.CreateSubKey(capabilitiesPath + @"\FileAssociations")) foreach (string extension in new[] { ".htm", ".html", ".xhtml", ".svg", ".pdf" }) key.SetValue(extension, "CypherHTML");
            using (var key = Registry.CurrentUser.CreateSubKey(capabilitiesPath + @"\StartMenu")) key.SetValue("StartMenuInternet", "Cypher");
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\RegisteredApplications")) key.SetValue("Cypher", capabilitiesPath);
            try { Registry.CurrentUser.DeleteSubKeyTree(@"Software\Cypher\Capabilities", false); } catch { }
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Cypher"))
            {
                key.SetValue("DisplayName", "Cypher"); key.SetValue("DisplayVersion", ProductVersion()); key.SetValue("Publisher", "Cypher");
                key.SetValue("InstallLocation", target); key.SetValue("DisplayIcon", executable + ",0");
                key.SetValue("UninstallString", Quote(uninstaller)); key.SetValue("NoModify", 1, RegistryValueKind.DWord); key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                key.SetValue("URLInfoAbout", "https://github.com/sCypher-me/cypher-browser");
                try { key.SetValue("EstimatedSize", (int)(PayloadBytes() / 1024), RegistryValueKind.DWord); } catch { }
            }
            if (options.Desktop) CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Cypher.lnk"), executable, target, "Navegador Cypher");
            else TryDeleteFile(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Cypher.lnk"));
            string programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            if (options.StartMenu)
            {
                string menu = Path.Combine(programs, "Cypher"); Directory.CreateDirectory(menu);
                CreateShortcut(Path.Combine(menu, "Cypher.lnk"), executable, target, "Navegador Cypher");
                CreateShortcut(Path.Combine(menu, "Desinstalar Cypher.lnk"), uninstaller, target, "Remover o Cypher");
            }
            else TryDelete(Path.Combine(programs, "Cypher"));
            NotifyAssociationsChanged();
        }

        [System.Runtime.InteropServices.DllImport("shell32.dll")] private static extern void SHChangeNotify(int eventId, int flags, IntPtr item1, IntPtr item2);
        private static void NotifyAssociationsChanged() { try { SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero); } catch { } }

        /// <summary>Opens the Windows default-apps page focused on Cypher. Windows requires the user to confirm the change.</summary>
        public static void OpenDefaultBrowserSettings()
        {
            foreach (string uri in new[] { "ms-settings:defaultapps?registeredAppUser=Cypher", "ms-settings:defaultapps" })
            {
                try { Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true }); return; } catch { }
            }
        }

        private static void RemoveLegacyUninstallEntries()
        {
            const string uninstallPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall";
            foreach (RegistryKey hive in new[] { Registry.CurrentUser, Registry.LocalMachine })
            {
                try
                {
                    using (var root = hive.OpenSubKey(uninstallPath, true))
                    {
                        if (root == null) continue;
                        foreach (string name in root.GetSubKeyNames())
                        {
                            if (string.Equals(name, "Cypher", StringComparison.OrdinalIgnoreCase)) continue;
                            bool isCypher = false;
                            using (var key = root.OpenSubKey(name, false))
                            {
                                string displayName = key == null ? null : key.GetValue("DisplayName") as string;
                                isCypher = string.Equals(displayName, "Cypher", StringComparison.OrdinalIgnoreCase);
                            }
                            if (isCypher) root.DeleteSubKeyTree(name, false);
                        }
                    }
                }
                catch { }
            }
        }

        private static string ProductVersion() { return SetupMetadata.Version; }

        private static void CreateShortcut(string path, string target, string workingDirectory, string description)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                object shell = Activator.CreateInstance(shellType);
                object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { path });
                Type shortcutType = shortcut.GetType();
                shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { target });
                shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workingDirectory });
                shortcutType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { description });
                shortcutType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { target + ",0" });
                shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
                if (System.Runtime.InteropServices.Marshal.IsComObject(shortcut)) System.Runtime.InteropServices.Marshal.ReleaseComObject(shortcut);
                if (System.Runtime.InteropServices.Marshal.IsComObject(shell)) System.Runtime.InteropServices.Marshal.ReleaseComObject(shell);
            }
            catch (Exception ex) { throw new IOException("Não foi possível criar o atalho do Cypher: " + path, ex); }
        }

        public static void LaunchInstalledCypher(string target, bool updated, string updateNotesBase64 = "") { StartCypher(target, updated, updateNotesBase64); }

        private static void StartCypher(string target, bool updated, string updateNotesBase64)
        {
            string app = Path.Combine(target, "Cypher.exe");
            if (!File.Exists(app)) throw new FileNotFoundException("Os arquivos do Cypher não foram encontrados.", app);
            string arguments = updated ? "--updated" : "";
            if (updated && !string.IsNullOrEmpty(updateNotesBase64)) arguments += " --cypher-update-notes=" + updateNotesBase64;
            Process.Start(new ProcessStartInfo(app) { WorkingDirectory = target, Arguments = arguments, UseShellExecute = true });
        }

        internal static void TryDelete(string path) { try { if (Directory.Exists(path)) Directory.Delete(path, true); else if (File.Exists(path)) File.Delete(path); } catch { } }
        internal static void TryDeleteFile(string path) { try { if (File.Exists(path)) File.Delete(path); } catch { } }

        public static string FormatBytes(long bytes)
        {
            if (bytes < 0) return "—";
            double value = bytes; string[] units = { "B", "KB", "MB", "GB", "TB" }; int unit = 0;
            while (value >= 1024 && unit < units.Length - 1) { value /= 1024; unit++; }
            return value.ToString(unit >= 3 ? "0.0" : "0") + " " + units[unit];
        }
    }

    /// <summary>The Cypher installer window: welcome, terms, folder, preferences, install with carousel, done.</summary>
    internal sealed class SetupWindow : Form
    {
        private static readonly string[] Steps = { "Boas-vindas", "Termos de uso", "Pasta", "Preferências", "Instalação", "Pronto" };
        private const int RailWidth = 256, TopHeight = 46, FooterHeight = 86;
        private readonly SetupOptions options;
        private readonly Canvas rail, top, footer;
        private readonly Panel content;
        private readonly CutButton backButton, nextButton;
        private readonly CheckRow termsCheck = new CheckRow { Text = "Li e aceito os Termos de Uso e o Aviso de Privacidade" };
        private readonly ToggleRow desktopRow, startMenuRow, defaultBrowserRow, reportsRow, launchRow;
        private FeatureCarousel carousel;
        private int page, progressValue;
        private string progressStatus = "Preparando a instalação";
        private string footerNote = "INSTALAÇÃO LOCAL · DADOS NO SEU PC";
        private bool installing, installed;
        private Exception installError;

        public SetupWindow(SetupOptions setupOptions)
        {
            options = setupOptions;
            Text = "Instalar o Cypher"; AutoScaleMode = AutoScaleMode.Dpi; AutoScaleDimensions = new SizeF(96f, 96f);
            ClientSize = new Size(980, 640); FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.CenterScreen;
            BackColor = CypherStyle.Background; DoubleBuffered = true; KeyPreview = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            rail = new Canvas { Bounds = new Rectangle(0, 0, RailWidth, 640) };
            rail.Paint += PaintRail; rail.MouseDown += DragWindow; Controls.Add(rail);
            top = new Canvas { Bounds = new Rectangle(RailWidth, 0, 980 - RailWidth, TopHeight) };
            top.Paint += PaintTop; top.MouseDown += DragWindow; top.MouseClick += TopClick; Controls.Add(top);
            content = new Panel { Bounds = new Rectangle(RailWidth, TopHeight, 980 - RailWidth, 640 - TopHeight - FooterHeight), BackColor = CypherStyle.Background };
            Controls.Add(content);
            footer = new Canvas { Bounds = new Rectangle(RailWidth, 640 - FooterHeight, 980 - RailWidth, FooterHeight) };
            footer.Paint += PaintFooter; Controls.Add(footer);
            backButton = new CutButton { Text = "Voltar", Style = CutButton.Kind.Ghost, Bounds = new Rectangle(footer.Width - 366, 22, 130, 44) };
            backButton.Click += delegate { if (page > 0 && page < 4) ShowPage(page - 1); };
            nextButton = new CutButton { Text = "Começar", Style = CutButton.Kind.Primary, Bounds = new Rectangle(footer.Width - 226, 22, 202, 44) };
            nextButton.Click += Next;
            footer.Controls.Add(backButton); footer.Controls.Add(nextButton);

            termsCheck.Changed += delegate { nextButton.Enabled = termsCheck.Checked; };
            desktopRow = MakeToggle("Atalho na área de trabalho", "Um atalho do Cypher na sua área de trabalho.", options.Desktop);
            startMenuRow = MakeToggle("Menu Iniciar", "O Cypher e o desinstalador aparecem no menu Iniciar.", options.StartMenu);
            defaultBrowserRow = MakeToggle("Definir como navegador padrão", "Ao concluir, abrimos as Configurações do Windows já na página do Cypher para você confirmar.", options.DefaultBrowser);
            reportsRow = MakeToggle("Enviar relatórios de erro", "Ajuda a encontrar e corrigir falhas. Nunca inclui sites visitados, senhas ou seus arquivos. Dá para desligar depois.", options.ErrorReports);
            launchRow = MakeToggle("Abrir o Cypher ao concluir", "Começar a navegar assim que a instalação terminar.", true);
            ShowPage(0);
        }

        private static ToggleRow MakeToggle(string title, string detail, bool value) { return new ToggleRow { Title = title, Detail = detail, Checked = value, Height = 80 }; }

        [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);
        private void DragWindow(object sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            if (sender == top && e.X > top.Width - 100) return;
            ReleaseCapture(); SendMessage(Handle, 0xA1, new IntPtr(2), IntPtr.Zero);
        }
        protected override CreateParams CreateParams { get { var parameters = base.CreateParams; parameters.ClassStyle |= 0x00020000; return parameters; } }

        private void TopClick(object sender, MouseEventArgs e)
        {
            if (e.X > top.Width - 50) Close();
            else if (e.X > top.Width - 100) WindowState = FormWindowState.Minimized;
        }

        private void PaintRail(object sender, PaintEventArgs e)
        {
            var g = e.Graphics; CypherStyle.Quality(g);
            using (var brush = new SolidBrush(Color.FromArgb(14, 13, 11))) g.FillRectangle(brush, rail.ClientRectangle);
            using (var pen = new Pen(Color.FromArgb(10, 236, 230, 216))) for (int x = -640; x < RailWidth; x += 28) g.DrawLine(pen, x, 640, x + 380, 0);
            using (var brush = new SolidBrush(CypherStyle.Accent)) g.FillPolygon(brush, new[] { new PointF(0, 640), new PointF(0, 560), new PointF(80, 640) });
            CypherStyle.DrawMark(g, new RectangleF(26, 28, 34, 34), CypherStyle.Accent);
            using (var font = CypherStyle.Display(22)) CypherStyle.Write(g, "CYPHER", font, CypherStyle.Text, new RectangleF(66, 26, 170, 40));
            using (var font = CypherStyle.Display(10)) CypherStyle.Write(g, "INSTALADOR  ·  " + SetupMetadata.Version, font, CypherStyle.Faint, new RectangleF(28, 70, 210, 20));
            for (int i = 0; i < Steps.Length; i++)
            {
                float y = 128 + i * 52;
                bool current = i == page, done = i < page;
                var chip = new RectangleF(18, y, RailWidth - 36, 40);
                if (current) using (var path = CypherStyle.Slant(chip, 10)) using (var brush = new SolidBrush(CypherStyle.Text)) g.FillPath(brush, path);
                using (var font = CypherStyle.Display(14))
                {
                    CypherStyle.Write(g, (i + 1).ToString("00"), font, current ? CypherStyle.Accent : done ? CypherStyle.Accent : CypherStyle.Faint, new RectangleF(32, y, 40, 40), StringAlignment.Near, StringAlignment.Center);
                    CypherStyle.Write(g, Steps[i].ToUpperInvariant(), font, current ? CypherStyle.Background : done ? CypherStyle.Text : CypherStyle.Muted, new RectangleF(68, y, RailWidth - 100, 40), StringAlignment.Near, StringAlignment.Center);
                }
                if (done) using (var pen = new Pen(CypherStyle.Accent, 2) { StartCap = LineCap.Round, EndCap = LineCap.Round }) g.DrawLines(pen, new[] { new PointF(RailWidth - 52, y + 21), new PointF(RailWidth - 47, y + 26), new PointF(RailWidth - 38, y + 15) });
            }
            using (var font = CypherStyle.Body(8.6f)) CypherStyle.Write(g, "Seu espaço.\nSuas regras.", font, CypherStyle.Muted, new RectangleF(28, 556, 200, 40));
        }

        private void PaintTop(object sender, PaintEventArgs e)
        {
            var g = e.Graphics; CypherStyle.Quality(g);
            using (var font = CypherStyle.Display(11)) CypherStyle.Write(g, string.Format("CYPHER  /  {0}", Steps[page].ToUpperInvariant()), font, CypherStyle.Faint, new RectangleF(34, 0, 400, TopHeight), StringAlignment.Near, StringAlignment.Center);
            using (var pen = new Pen(CypherStyle.Muted, 1.4f))
            {
                g.DrawLine(pen, top.Width - 80, TopHeight / 2f + 1, top.Width - 68, TopHeight / 2f + 1);
                g.DrawLine(pen, top.Width - 30, TopHeight / 2f - 6, top.Width - 18, TopHeight / 2f + 6);
                g.DrawLine(pen, top.Width - 18, TopHeight / 2f - 6, top.Width - 30, TopHeight / 2f + 6);
            }
        }

        private void PaintFooter(object sender, PaintEventArgs e)
        {
            var g = e.Graphics; CypherStyle.Quality(g);
            using (var pen = new Pen(CypherStyle.Line)) g.DrawLine(pen, 34, 0, footer.Width - 24, 0);
            using (var font = CypherStyle.Display(10.5f)) CypherStyle.Write(g, footerNote, font, CypherStyle.Faint, new RectangleF(34, 0, footer.Width - 410, FooterHeight), StringAlignment.Near, StringAlignment.Center);
        }

        private void Heading(string kicker, string title, string copy, int y = 30)
        {
            var heading = new Canvas { Bounds = new Rectangle(34, y, content.Width - 70, string.IsNullOrEmpty(copy) ? 92 : 140) };
            heading.Paint += delegate(object sender, PaintEventArgs e)
            {
                var g = e.Graphics; CypherStyle.Quality(g);
                using (var font = CypherStyle.Display(11)) CypherStyle.Write(g, kicker, font, CypherStyle.Accent, new RectangleF(0, 0, heading.Width, 22));
                using (var font = CypherStyle.Display(34)) CypherStyle.Write(g, title.ToUpperInvariant(), font, CypherStyle.Text, new RectangleF(-2, 22, heading.Width, 56));
                if (!string.IsNullOrEmpty(copy)) using (var font = CypherStyle.Body(10)) CypherStyle.Write(g, copy, font, CypherStyle.Muted, new RectangleF(0, 82, heading.Width - 40, 56));
            };
            content.Controls.Add(heading);
        }

        private void ShowPage(int target)
        {
            page = target;
            if (carousel != null && page != 4) { carousel.Stop(); }
            content.Controls.Clear();
            backButton.Visible = page > 0 && page < 4;
            nextButton.Visible = true; nextButton.Enabled = true;
            nextButton.Text = page == 0 ? "Começar" : page == 1 ? "Aceitar e continuar" : page == 2 ? "Continuar" : page == 3 ? "Instalar" : page == 4 ? "Continuar" : launchRow.Checked ? "Abrir o Cypher" : "Concluir";
            footerNote = page == 4 ? "USE O PC À VONTADE ENQUANTO ISSO" : page == 5 ? "OBRIGADO POR ESCOLHER O CYPHER" : "INSTALAÇÃO LOCAL · DADOS NO SEU PC";
            if (page == 0) BuildWelcome();
            if (page == 1) BuildTerms();
            if (page == 2) BuildFolder();
            if (page == 3) BuildPreferences();
            if (page == 4) BuildInstall();
            if (page == 5) BuildDone();
            rail.Invalidate(); top.Invalidate(); footer.Invalidate();
        }

        private void BuildWelcome()
        {
            var hero = new Canvas { Bounds = new Rectangle(0, 0, content.Width, content.Height) };
            hero.Paint += delegate(object sender, PaintEventArgs e)
            {
                var g = e.Graphics; CypherStyle.Quality(g);
                using (var pen = new Pen(Color.FromArgb(22, 255, 84, 54), 1.2f)) for (int i = 0; i < 9; i++) g.DrawEllipse(pen, hero.Width - 260 + i * 6, 40 + i * 6, 300 - i * 12, 300 - i * 12);
                using (var brush = new SolidBrush(CypherStyle.Accent)) g.FillPolygon(brush, new[] { new PointF(hero.Width, 0), new PointF(hero.Width, 90), new PointF(hero.Width - 90, 0) });
                using (var font = CypherStyle.Display(11)) CypherStyle.Write(g, "INSTALADOR OFICIAL  ·  WINDOWS 10 E 11", font, CypherStyle.Accent, new RectangleF(34, 44, 500, 22));
                using (var font = CypherStyle.Display(60))
                {
                    CypherStyle.Write(g, "NAVEGUE", font, CypherStyle.Text, new RectangleF(28, 66, 600, 90));
                    CypherStyle.Write(g, "DO SEU JEITO.", font, CypherStyle.Accent, new RectangleF(28, 140, 640, 90));
                }
                using (var font = CypherStyle.Body(10.5f)) CypherStyle.Write(g, "Privacidade de verdade, mods que mudam tudo e uma interface que você\nmonta peça por peça. Vamos preparar o Cypher no seu computador.", font, CypherStyle.Muted, new RectangleF(34, 236, 600, 50));
                string[][] facts = { new[] { "~2 MIN", "para instalar" }, new[] { "0", "contas obrigatórias" }, new[] { "100%", "dados no seu PC" } };
                for (int i = 0; i < facts.Length; i++)
                {
                    var box = new RectangleF(34 + i * 214, 318, 198, 96);
                    using (var path = CypherStyle.Cut(box, 12)) { using (var brush = new SolidBrush(CypherStyle.Surface)) g.FillPath(brush, path); using (var pen = new Pen(CypherStyle.Line)) g.DrawPath(pen, path); }
                    using (var font = CypherStyle.Display(30)) CypherStyle.Write(g, facts[i][0], font, CypherStyle.Text, new RectangleF(box.X + 18, box.Y + 10, box.Width - 20, 50));
                    using (var font = CypherStyle.Body(9)) CypherStyle.Write(g, facts[i][1], font, CypherStyle.Muted, new RectangleF(box.X + 20, box.Y + 60, box.Width - 20, 24));
                }
            };
            content.Controls.Add(hero);
        }

        private void BuildTerms()
        {
            Heading("ANTES DE COMEÇAR", "Termos de uso", "", 26);
            var view = new TermsView { Bounds = new Rectangle(34, 112, content.Width - 70, 300), Body = SetupEngine.TermsText() };
            content.Controls.Add(view);
            termsCheck.Bounds = new Rectangle(34, 428, content.Width - 70, 30);
            termsCheck.Checked = options.TermsAccepted;
            content.Controls.Add(termsCheck);
            nextButton.Enabled = termsCheck.Checked;
        }

        private TextBox pathBox;
        private Canvas folderCard;
        private string folderError = "";
        private bool folderIsUpdate;
        private long folderFree = -1;

        private void BuildFolder()
        {
            Heading("ONDE O CYPHER VAI MORAR", "Pasta de instalação", "Seu perfil, favoritos e configurações ficam separados dos arquivos do programa e são preservados em atualizações.", 26);
            var scopes = new[] { new { Title = "Só para mim", Detail = "Recomendado · sem pedir permissão", Path = SetupOptions.DefaultTarget }, new { Title = "Para todos os usuários", Detail = "Arquivos de Programas · pede permissão", Path = SetupOptions.AllUsersTarget } };
            for (int i = 0; i < scopes.Length; i++)
            {
                var scope = scopes[i];
                var card = new Canvas { Bounds = new Rectangle(34 + i * ((content.Width - 82) / 2 + 12), 172, (content.Width - 82) / 2, 70), Cursor = Cursors.Hand };
                card.Paint += delegate(object sender, PaintEventArgs e)
                {
                    var g = e.Graphics; CypherStyle.Quality(g);
                    bool chosen = pathBox != null && string.Equals(pathBox.Text.TrimEnd('\\'), scope.Path.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);
                    var rect = new RectangleF(0.5f, 0.5f, card.Width - 1.5f, card.Height - 1.5f);
                    using (var path = CypherStyle.Cut(rect, 10)) { using (var brush = new SolidBrush(chosen ? Color.FromArgb(40, 255, 84, 54) : CypherStyle.Surface)) g.FillPath(brush, path); using (var pen = new Pen(chosen ? CypherStyle.Accent : CypherStyle.Line)) g.DrawPath(pen, path); }
                    using (var font = CypherStyle.Display(16)) CypherStyle.Write(g, scope.Title.ToUpperInvariant(), font, CypherStyle.Text, new RectangleF(18, 10, card.Width - 30, 28));
                    using (var font = CypherStyle.Body(8.8f)) CypherStyle.Write(g, scope.Detail, font, CypherStyle.Muted, new RectangleF(18, 40, card.Width - 30, 22));
                };
                card.Click += delegate { pathBox.Text = scope.Path; };
                content.Controls.Add(card);
            }
            folderCard = new Canvas { Bounds = new Rectangle(34, 258, content.Width - 70, 112) };
            folderCard.Paint += PaintFolderCard;
            content.Controls.Add(folderCard);
            pathBox = new TextBox { Bounds = new Rectangle(70, 30, folderCard.Width - 240, 26), BorderStyle = BorderStyle.None, BackColor = CypherStyle.Raised, ForeColor = CypherStyle.Text, Font = CypherStyle.Body(11), Text = options.Target };
            pathBox.TextChanged += delegate { ValidateFolder(); };
            folderCard.Controls.Add(pathBox);
            var change = new CutButton { Text = "Alterar", Style = CutButton.Kind.Secondary, Bounds = new Rectangle(folderCard.Width - 150, 22, 130, 40) };
            change.Click += delegate
            {
                using (var dialog = new FolderBrowserDialog { Description = "Escolha a pasta onde o Cypher será instalado. Uma subpasta \"Cypher\" é criada se a pasta não estiver vazia.", SelectedPath = Directory.Exists(pathBox.Text) ? pathBox.Text : Path.GetDirectoryName(pathBox.Text), ShowNewFolderButton = true })
                {
                    if (dialog.ShowDialog(this) != DialogResult.OK) return;
                    string chosen = dialog.SelectedPath;
                    bool emptyOrCypher = !Directory.Exists(chosen) || File.Exists(Path.Combine(chosen, "Cypher.exe")) || !Directory.EnumerateFileSystemEntries(chosen).Any();
                    pathBox.Text = emptyOrCypher ? chosen : Path.Combine(chosen, "Cypher");
                }
            };
            folderCard.Controls.Add(change);
            ValidateFolder();
        }

        private void ValidateFolder()
        {
            folderError = SetupEngine.DescribeTarget(pathBox.Text.Trim(), out folderIsUpdate, out folderFree);
            nextButton.Enabled = folderError.Length == 0;
            foreach (Control control in content.Controls) control.Invalidate();
        }

        private void PaintFolderCard(object sender, PaintEventArgs e)
        {
            var g = e.Graphics; CypherStyle.Quality(g);
            var rect = new RectangleF(0.5f, 0.5f, folderCard.Width - 1.5f, folderCard.Height - 1.5f);
            using (var path = CypherStyle.Cut(rect, 14)) { using (var brush = new SolidBrush(CypherStyle.Surface)) g.FillPath(brush, path); using (var pen = new Pen(folderError.Length > 0 ? CypherStyle.Warning : CypherStyle.Line)) g.DrawPath(pen, path); }
            using (var brush = new SolidBrush(CypherStyle.Raised)) g.FillRectangle(brush, 62, 24, folderCard.Width - 222, 38);
            var folder = new[] { new PointF(20, 30), new PointF(32, 30), new PointF(36, 34), new PointF(48, 34), new PointF(48, 56), new PointF(20, 56) };
            using (var brush = new SolidBrush(CypherStyle.Accent)) g.FillPolygon(brush, folder);
            long needed = SetupEngine.PayloadBytes();
            string info = folderError.Length > 0 ? folderError
                : (folderIsUpdate ? "Encontramos o Cypher aqui: ele será atualizado e seu perfil continua intacto.  ·  " : "")
                  + "Necessário: " + (needed > 0 ? SetupEngine.FormatBytes(needed) : "—") + "  ·  Disponível: " + SetupEngine.FormatBytes(folderFree)
                  + (pathBox != null && SetupEngine.NeedsElevation(pathBox.Text.Trim()) ? "  ·  O Windows vai pedir permissão" : "");
            using (var font = CypherStyle.Body(9)) CypherStyle.Write(g, info, font, folderError.Length > 0 ? CypherStyle.Warning : CypherStyle.Muted, new RectangleF(20, 74, folderCard.Width - 40, 30));
        }

        private void BuildPreferences()
        {
            Heading("DO SEU JEITO", "Preferências", "", 26);
            int y = 108;
            foreach (var row in new[] { defaultBrowserRow, reportsRow, desktopRow, startMenuRow })
            {
                row.Bounds = new Rectangle(34, y, content.Width - 70, 80);
                content.Controls.Add(row); y += 88;
            }
        }

        private void BuildInstall()
        {
            carousel = new FeatureCarousel { Bounds = new Rectangle(34, 24, content.Width - 70, 330) };
            content.Controls.Add(carousel);
            var progress = new Canvas { Bounds = new Rectangle(34, 372, content.Width - 70, 100) };
            progress.Paint += delegate(object sender, PaintEventArgs e)
            {
                var g = e.Graphics; CypherStyle.Quality(g);
                using (var font = CypherStyle.Display(40)) CypherStyle.Write(g, progressValue + "%", font, installError != null ? CypherStyle.Warning : CypherStyle.Text, new RectangleF(-2, 0, 160, 56));
                using (var font = CypherStyle.Body(9.5f)) CypherStyle.Write(g, installError != null ? installError.GetBaseException().Message : progressStatus, font, installError != null ? CypherStyle.Warning : CypherStyle.Muted, new RectangleF(150, 14, progress.Width - 150, 40), StringAlignment.Near, StringAlignment.Near);
                int segments = 40; float gap = 4, width = (progress.Width - gap * (segments - 1)) / segments;
                for (int i = 0; i < segments; i++)
                {
                    bool filled = i < Math.Round(progressValue / 100.0 * segments);
                    var segment = new RectangleF(i * (width + gap), 66, width, 14);
                    using (var path = CypherStyle.Slant(segment, 4)) using (var brush = new SolidBrush(filled ? (installError != null ? CypherStyle.Warning : CypherStyle.Accent) : CypherStyle.Line)) g.FillPath(brush, path);
                }
            };
            content.Controls.Add(progress);
            carousel.Start();
            nextButton.Enabled = installed;
            if (!installing && !installed) BeginInstall(progress);
        }

        private void BuildDone()
        {
            var panel = new Canvas { Bounds = new Rectangle(0, 0, content.Width, content.Height) };
            var summary = new List<string[]>
            {
                new[] { "ok", "Instalado em " + Path.GetFullPath(options.Target) },
                new[] { options.Desktop || options.StartMenu ? "ok" : "off", options.Desktop && options.StartMenu ? "Atalhos na área de trabalho e no menu Iniciar" : options.Desktop ? "Atalho na área de trabalho" : options.StartMenu ? "Atalho no menu Iniciar" : "Sem atalhos (abra pela pasta de instalação)" },
                new[] { options.DefaultBrowser ? "ok" : "off", options.DefaultBrowser ? "Navegador padrão: confirme na janela do Windows que vamos abrir" : "Navegador padrão: você pode definir depois em Configurações → Sistema" },
                new[] { options.ErrorReports ? "ok" : "off", options.ErrorReports ? "Relatórios de erro ativados (dá para desligar em Configurações)" : "Relatórios de erro desativados" },
                new[] { "ok", "Termos de uso aceitos · cópia salva em TERMOS-DE-USO.txt" },
            };
            panel.Paint += delegate(object sender, PaintEventArgs e)
            {
                var g = e.Graphics; CypherStyle.Quality(g);
                var badge = new RectangleF(34, 34, 96, 96);
                using (var path = CypherStyle.Cut(badge, 18)) using (var brush = new SolidBrush(CypherStyle.Accent)) g.FillPath(brush, path);
                using (var pen = new Pen(CypherStyle.Background, 7) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round }) g.DrawLines(pen, new[] { new PointF(60, 84), new PointF(76, 100), new PointF(106, 66) });
                using (var font = CypherStyle.Display(11)) CypherStyle.Write(g, "INSTALAÇÃO CONCLUÍDA  ·  " + SetupMetadata.Version, font, CypherStyle.Accent, new RectangleF(152, 44, 500, 22));
                using (var font = CypherStyle.Display(46)) CypherStyle.Write(g, "TUDO PRONTO.", font, CypherStyle.Text, new RectangleF(148, 64, 560, 70));
                for (int i = 0; i < summary.Count; i++)
                {
                    float y = 160 + i * 42;
                    bool ok = summary[i][0] == "ok";
                    var mark = new RectangleF(34, y + 6, 22, 22);
                    using (var path = CypherStyle.Cut(mark, 5)) using (var brush = new SolidBrush(ok ? Color.FromArgb(45, 155, 227, 166) : CypherStyle.Surface)) g.FillPath(brush, path);
                    if (ok) using (var pen = new Pen(CypherStyle.Good, 2.2f) { StartCap = LineCap.Round, EndCap = LineCap.Round }) g.DrawLines(pen, new[] { new PointF(mark.X + 6, mark.Y + 11.5f), new PointF(mark.X + 9.5f, mark.Y + 15), new PointF(mark.X + 16, mark.Y + 8) });
                    else using (var pen = new Pen(CypherStyle.Faint, 2)) g.DrawLine(pen, mark.X + 7, mark.Y + 11, mark.X + 15, mark.Y + 11);
                    using (var font = CypherStyle.Body(10)) CypherStyle.Write(g, summary[i][1], font, ok ? CypherStyle.Text : CypherStyle.Muted, new RectangleF(70, y, panel.Width - 110, 34), StringAlignment.Near, StringAlignment.Center);
                }
            };
            content.Controls.Add(panel);
            launchRow.Bounds = new Rectangle(34, content.Height - 90, content.Width - 70, 74);
            launchRow.Changed += delegate { nextButton.Text = launchRow.Checked ? "Abrir o Cypher" : "Concluir"; nextButton.Invalidate(); };
            panel.Controls.Add(launchRow);
        }

        private void Next(object sender, EventArgs e)
        {
            if (!nextButton.Enabled) return;
            if (page == 0) { ShowPage(1); return; }
            if (page == 1) { if (!termsCheck.Checked) return; options.TermsAccepted = true; ShowPage(2); return; }
            if (page == 2)
            {
                ValidateFolder();
                if (folderError.Length > 0) return;
                options.Target = pathBox.Text.Trim();
                ShowPage(3); return;
            }
            if (page == 3)
            {
                options.Desktop = desktopRow.Checked; options.StartMenu = startMenuRow.Checked;
                options.DefaultBrowser = defaultBrowserRow.Checked; options.ErrorReports = reportsRow.Checked;
                ShowPage(4); return;
            }
            if (page == 4) { if (installed) ShowPage(5); else if (installError != null) { installError = null; ShowPage(2); } return; }
            if (page == 5)
            {
                try
                {
                    if (options.DefaultBrowser) SetupEngine.OpenDefaultBrowserSettings();
                    if (launchRow.Checked) SetupEngine.LaunchInstalledCypher(options.Target, options.Updated, options.UpdateNotesBase64);
                    Close();
                }
                catch (Exception ex) { MessageBox.Show(this, ex.Message, "Cypher instalado", MessageBoxButtons.OK, MessageBoxIcon.Information); }
            }
        }

        private void BeginInstall(Control progress)
        {
            installing = true; installError = null;
            var worker = new System.ComponentModel.BackgroundWorker { WorkerReportsProgress = true };
            worker.DoWork += delegate(object sender, System.ComponentModel.DoWorkEventArgs e)
            {
                e.Result = SetupEngine.Install(options, delegate(int value, string text) { worker.ReportProgress(value, text); });
            };
            worker.ProgressChanged += delegate(object sender, System.ComponentModel.ProgressChangedEventArgs e)
            {
                progressValue = e.ProgressPercentage; progressStatus = Convert.ToString(e.UserState);
                progress.Invalidate();
            };
            worker.RunWorkerCompleted += delegate(object sender, System.ComponentModel.RunWorkerCompletedEventArgs e)
            {
                installing = false;
                if (e.Error != null)
                {
                    installError = e.Error;
                    nextButton.Text = "Tentar de novo"; nextButton.Enabled = true; nextButton.Invalidate();
                    progress.Invalidate(); return;
                }
                installed = true; progressValue = 100; progressStatus = "Instalado. Explore as novidades ou continue quando quiser.";
                nextButton.Enabled = true; nextButton.Invalidate(); progress.Invalidate();
            };
            worker.RunWorkerAsync();
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (keyData == Keys.Escape && !installing) { Close(); return true; }
            if (keyData == Keys.Enter && nextButton.Enabled && !(ActiveControl is TextBox)) { Next(this, EventArgs.Empty); return true; }
            if (page == 4 && carousel != null && (keyData == Keys.Right || keyData == Keys.Left)) { carousel.Go(keyData == Keys.Right ? 99 : -1); return true; }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (installing && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; return; }
            if (!installed && page > 0 && page < 4 && e.CloseReason == CloseReason.UserClosing &&
                MessageBox.Show(this, "Sair sem instalar o Cypher?", "Instalar o Cypher", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes)
            { e.Cancel = true; return; }
            base.OnFormClosing(e);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            using (var pen = new Pen(CypherStyle.Line)) e.Graphics.DrawRectangle(pen, 0, 0, ClientSize.Width - 1, ClientSize.Height - 1);
            base.OnPaint(e);
        }

        /// <summary>Development helper: renders every page to PNG files without installing anything.</summary>
        public static void RenderPages(SetupOptions options)
        {
            Directory.CreateDirectory(options.RenderPagesTo);
            using (var window = new SetupWindow(options))
            {
                window.StartPosition = FormStartPosition.Manual; window.Location = new Point(-4000, -4000); window.ShowInTaskbar = false;
                window.Show(); Application.DoEvents();
                for (int i = 0; i < Steps.Length; i++)
                {
                    if (i == 1) window.termsCheck.Checked = true;
                    if (i == 4)
                    {
                        window.page = 4; window.content.Controls.Clear(); window.installed = false; window.installing = true;
                        window.progressValue = 46; window.progressStatus = "Copiando arquivos do navegador · 214 de 468";
                        window.ShowPage(4);
                    }
                    else window.ShowPage(i);
                    if (i == 1) { window.termsCheck.Checked = true; window.nextButton.Enabled = true; }
                    Application.DoEvents();
                    using (var bitmap = new Bitmap(window.Width, window.Height))
                    {
                        window.DrawToBitmap(bitmap, new Rectangle(0, 0, window.Width, window.Height));
                        bitmap.Save(Path.Combine(options.RenderPagesTo, string.Format("setup-{0:00}.png", i + 1)), ImageFormat.Png);
                    }
                    if (i == 4)
                    {
                        window.carousel.Go(2); for (int frame = 0; frame < 40; frame++) { Thread.Sleep(16); Application.DoEvents(); }
                        using (var bitmap = new Bitmap(window.Width, window.Height))
                        {
                            window.DrawToBitmap(bitmap, new Rectangle(0, 0, window.Width, window.Height));
                            bitmap.Save(Path.Combine(options.RenderPagesTo, "setup-05b.png"), ImageFormat.Png);
                        }
                    }
                }
                window.installing = false; window.installed = true; window.Close();
            }
        }
    }

#else
    internal sealed class UninstallerWindow : Form
    {
        private readonly CheckRow removeData = new CheckRow { Text = "Também apagar favoritos, histórico, senhas e configurações" };
        private readonly CutButton cancel, uninstall;
        private bool removing;

        public UninstallerWindow()
        {
            Text = "Remover o Cypher"; AutoScaleMode = AutoScaleMode.Dpi; AutoScaleDimensions = new SizeF(96f, 96f);
            ClientSize = new Size(620, 380); FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.CenterScreen;
            BackColor = CypherStyle.Background; DoubleBuffered = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            var canvas = new Canvas { Bounds = new Rectangle(0, 0, 620, 380) };
            canvas.Paint += PaintCanvas;
            canvas.MouseDown += delegate(object sender, MouseEventArgs e) { if (e.Button == MouseButtons.Left && e.Y < 50 && e.X < 570) { ReleaseCapture(); SendMessage(Handle, 0xA1, new IntPtr(2), IntPtr.Zero); } };
            canvas.MouseClick += delegate(object sender, MouseEventArgs e) { if (e.Y < 50 && e.X >= 570 && !removing) Close(); };
            Controls.Add(canvas);
            removeData.Bounds = new Rectangle(34, 214, 552, 30);
            canvas.Controls.Add(removeData);
            cancel = new CutButton { Text = "Cancelar", Style = CutButton.Kind.Ghost, Bounds = new Rectangle(300, 306, 130, 44) }; cancel.Click += delegate { if (!removing) Close(); };
            uninstall = new CutButton { Text = "Remover", Style = CutButton.Kind.Primary, Bounds = new Rectangle(440, 306, 150, 44) }; uninstall.Click += Remove;
            canvas.Controls.Add(cancel); canvas.Controls.Add(uninstall);
        }

        [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);
        protected override CreateParams CreateParams { get { var parameters = base.CreateParams; parameters.ClassStyle |= 0x00020000; return parameters; } }

        private void PaintCanvas(object sender, PaintEventArgs e)
        {
            var g = e.Graphics; CypherStyle.Quality(g);
            using (var pen = new Pen(CypherStyle.Line)) g.DrawRectangle(pen, 0, 0, 619, 379);
            using (var brush = new SolidBrush(CypherStyle.Accent)) g.FillPolygon(brush, new[] { new PointF(620, 0), new PointF(620, 60), new PointF(560, 0) });
            CypherStyle.DrawMark(g, new RectangleF(30, 14, 26, 26), CypherStyle.Accent);
            using (var font = CypherStyle.Display(11)) CypherStyle.Write(g, "CYPHER  /  REMOÇÃO", font, CypherStyle.Faint, new RectangleF(64, 14, 300, 26), StringAlignment.Near, StringAlignment.Center);
            using (var pen = new Pen(CypherStyle.Background, 1.6f)) { g.DrawLine(pen, 592, 14, 602, 24); g.DrawLine(pen, 602, 14, 592, 24); }
            using (var font = CypherStyle.Display(34)) CypherStyle.Write(g, removing ? "REMOVENDO…" : "REMOVER O CYPHER?", font, CypherStyle.Text, new RectangleF(30, 74, 560, 56));
            using (var font = CypherStyle.Body(10)) CypherStyle.Write(g, "O navegador, os atalhos e o registro no Windows serão removidos.\nSeu perfil fica guardado, a menos que você marque a opção abaixo.", font, CypherStyle.Muted, new RectangleF(34, 136, 560, 50));
            using (var font = CypherStyle.Body(8.8f)) CypherStyle.Write(g, "Apagar o perfil não pode ser desfeito.", font, CypherStyle.Warning, new RectangleF(66, 248, 520, 22));
        }

        private void Remove(object sender, EventArgs e)
        {
            string location = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
            if (!File.Exists(Path.Combine(location, "Cypher.exe")))
            {
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Cypher", false)) location = key == null ? location : Convert.ToString(key.GetValue("InstallLocation", location));
            }
            try
            {
                foreach (var process in Process.GetProcessesByName("Cypher"))
                {
                    try { if (!process.CloseMainWindow() || !process.WaitForExit(12000)) throw new InvalidOperationException("Feche o Cypher antes de removê-lo."); }
                    finally { process.Dispose(); }
                }
                removing = true; cancel.Enabled = false; uninstall.Enabled = false; Controls[0].Invalidate(); Application.DoEvents();
                string script = BuildCleanupScript(location, removeData.Checked, Process.GetCurrentProcess().Id);
                string encoded = Convert.ToBase64String(Encoding.Unicode.GetBytes(script));
                Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell\\v1.0\\powershell.exe"), "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand " + encoded) { UseShellExecute = false, CreateNoWindow = true });
                Close();
            }
            catch (Exception ex)
            {
                removing = false; cancel.Enabled = true; uninstall.Enabled = true; Controls[0].Invalidate();
                MessageBox.Show(this, ex.Message, "Não foi possível remover o Cypher", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static string Ps(string value) { return "'" + value.Replace("'", "''") + "'"; }
        private static string BuildCleanupScript(string location, bool deleteProfile, int parentProcess)
        {
            string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Cypher");
            var script = new StringBuilder();
            script.AppendLine("$parent=" + parentProcess + "; while (Get-Process -Id $parent -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 400 }");
            script.AppendLine("$install=" + Ps(location) + "; $desktop=" + Ps(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Cypher.lnk")) + "; $programs=" + Ps(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Cypher")) + "; $profile=" + Ps(appData) + "; $removeProfile=" + (deleteProfile ? "$true" : "$false"));
            script.AppendLine("Remove-Item -LiteralPath $desktop -Force -ErrorAction SilentlyContinue");
            script.AppendLine("Remove-Item -LiteralPath $programs -Recurse -Force -ErrorAction SilentlyContinue");
            script.AppendLine("Remove-ItemProperty -LiteralPath 'HKCU:\\Software\\RegisteredApplications' -Name 'Cypher' -Force -ErrorAction SilentlyContinue");
            script.AppendLine("Remove-Item -LiteralPath 'HKCU:\\Software\\Classes\\CypherURL' -Recurse -Force -ErrorAction SilentlyContinue");
            script.AppendLine("Remove-Item -LiteralPath 'HKCU:\\Software\\Classes\\CypherHTML' -Recurse -Force -ErrorAction SilentlyContinue");
            script.AppendLine("foreach ($ext in '.htm','.html','.xhtml','.svg','.pdf') { Remove-ItemProperty -LiteralPath ('HKCU:\\Software\\Classes\\' + $ext + '\\OpenWithProgids') -Name 'CypherHTML' -Force -ErrorAction SilentlyContinue }");
            script.AppendLine("Remove-Item -LiteralPath 'HKCU:\\Software\\Clients\\StartMenuInternet\\Cypher' -Recurse -Force -ErrorAction SilentlyContinue");
            script.AppendLine("Remove-Item -LiteralPath 'HKCU:\\Software\\Cypher' -Recurse -Force -ErrorAction SilentlyContinue");
            script.AppendLine("Remove-Item -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Cypher' -Recurse -Force -ErrorAction SilentlyContinue");
            script.AppendLine("if ($removeProfile) { Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue }");
            script.AppendLine("if ($install.Length -gt 5 -and (Test-Path -LiteralPath $install)) { Remove-Item -LiteralPath $install -Recurse -Force -ErrorAction SilentlyContinue }");
            return script.ToString();
        }
    }
#endif
}
