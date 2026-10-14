using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
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
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
#if UNINSTALLER
            Application.Run(new UninstallerWindow());
#else
            var options = SetupOptions.Parse(args);
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
        public static readonly Color Background = Color.FromArgb(9, 13, 11);
        public static readonly Color Panel = Color.FromArgb(16, 22, 19);
        public static readonly Color PanelRaised = Color.FromArgb(21, 29, 24);
        public static readonly Color Border = Color.FromArgb(43, 58, 47);
        public static readonly Color Accent = Color.FromArgb(182, 243, 106);
        public static readonly Color Text = Color.FromArgb(237, 242, 233);
        public static readonly Color Muted = Color.FromArgb(147, 163, 146);

        public static GraphicsPath Rounded(Rectangle rect, int radius)
        {
            var path = new GraphicsPath();
            int d = radius * 2;
            path.AddArc(rect.X, rect.Y, d, d, 180, 90);
            path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
            path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
            path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        public static void DrawMark(Graphics graphics, Rectangle rect, Color color)
        {
            float x = rect.X, y = rect.Y, w = rect.Width, h = rect.Height;
            PointF[] points = {
                new PointF(x + w*.08f,y+h*.50f), new PointF(x+w*.34f,y+h*.19f),
                new PointF(x+w*.82f,y+h*.19f), new PointF(x+w*.82f,y+h*.34f),
                new PointF(x+w*.42f,y+h*.34f), new PointF(x+w*.26f,y+h*.50f),
                new PointF(x+w*.42f,y+h*.66f), new PointF(x+w*.82f,y+h*.66f),
                new PointF(x+w*.82f,y+h*.81f), new PointF(x+w*.34f,y+h*.81f)
            };
            using (var brush = new SolidBrush(color)) graphics.FillPolygon(brush, points);
            using (var brush = new SolidBrush(Color.FromArgb(110, color)))
                graphics.FillPolygon(brush, new[] { new PointF(x+w*.64f,y+h*.50f), new PointF(x+w*.81f,y+h*.40f), new PointF(x+w*.95f,y+h*.50f) });
        }

        public static Label Label(string text, float size, Color color, FontStyle style)
        {
            return new Label { Text = text, AutoSize = false, ForeColor = color, BackColor = Color.Transparent, Font = new Font("Segoe UI", size, style, GraphicsUnit.Point), UseCompatibleTextRendering = false, UseMnemonic = false };
        }

        public static void DrawSidebar(Graphics g, int height)
        {
            using (var brush = new LinearGradientBrush(new Rectangle(0, 0, 286, height), Color.FromArgb(18, 29, 22), Color.FromArgb(10, 15, 12), 110f)) g.FillRectangle(brush, 0, 0, 286, height);
            using (var pen = new Pen(Border)) g.DrawLine(pen, 285, 0, 285, height);
            for (int i = -height; i < 300; i += 30)
                using (var pen = new Pen(Color.FromArgb(20, Accent), 1f)) g.DrawLine(pen, i, 0, i + height, height);
            using (var pen = new Pen(Color.FromArgb(25, Accent), 1f))
            {
                g.DrawEllipse(pen, 75, height - 280, 180, 180);
                g.DrawEllipse(pen, 92, height - 263, 146, 146);
                g.DrawEllipse(pen, 110, height - 245, 110, 110);
            }
            using (var brush = new SolidBrush(Color.FromArgb(18, Accent))) g.FillEllipse(brush, 113, height - 242, 104, 104);
        }
    }

    internal sealed class AccentButton : Button
    {
        public bool Primary { get; set; }
        private bool hovered;
        public AccentButton()
        {
            FlatStyle = FlatStyle.Flat; FlatAppearance.BorderSize = 0; UseVisualStyleBackColor = false;
            Cursor = Cursors.Hand; Font = new Font("Segoe UI", 9.5f, FontStyle.Bold); ForeColor = CypherStyle.Text;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
        }
        protected override void OnMouseEnter(EventArgs e) { hovered = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { hovered = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            var bounds = new Rectangle(0, 0, Width - 1, Height - 1);
            using (var path = CypherStyle.Rounded(bounds, 8))
            using (var fill = new SolidBrush(Primary ? (hovered ? Color.FromArgb(202, 255, 130) : CypherStyle.Accent) : (hovered ? CypherStyle.PanelRaised : CypherStyle.Panel)))
            using (var edge = new Pen(Primary ? CypherStyle.Accent : CypherStyle.Border))
            {
                e.Graphics.FillPath(fill, path);
                if (!Primary) e.Graphics.DrawPath(edge, path);
            }
            TextRenderer.DrawText(e.Graphics, Text, Font, bounds, Primary ? CypherStyle.Background : CypherStyle.Text, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
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
        public string Target;
        public bool Desktop = true;
        public bool StartMenu = true;

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
                if (string.Equals(arg, "--defer-launch", StringComparison.OrdinalIgnoreCase)) result.DeferLaunch = true;
                if (arg.StartsWith("--wait-for-process=", StringComparison.OrdinalIgnoreCase)) int.TryParse(arg.Substring(19), out result.WaitForProcessId);
                if (string.Equals(arg, "--wait-for-process", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length) int.TryParse(args[++i], out result.WaitForProcessId);
                if (string.Equals(arg, "--no-desktop", StringComparison.OrdinalIgnoreCase)) result.Desktop = false;
                if (string.Equals(arg, "--no-start-menu", StringComparison.OrdinalIgnoreCase)) result.StartMenu = false;
                if (arg.StartsWith("--target=", StringComparison.OrdinalIgnoreCase)) result.Target = arg.Substring(9).Trim('"');
                if (string.Equals(arg, "--target", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length) result.Target = args[++i].Trim('"');
            }
            if (string.IsNullOrWhiteSpace(result.Target))
            {
#if !UNINSTALLER
                result.Target = SetupEngine.FindInstallLocation();
#endif
            }
            if (result.Silent)
            {
                try
                {
                    using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Cypher", false))
                    {
                        if (key != null)
                        {
                            result.Desktop = Convert.ToInt32(key.GetValue("CreateDesktopShortcut", 1)) != 0;
                            result.StartMenu = Convert.ToInt32(key.GetValue("CreateStartMenuShortcut", 1)) != 0;
                        }
                    }
                }
                catch { }
            }
            if (args.Any(arg => string.Equals(arg, "--no-desktop", StringComparison.OrdinalIgnoreCase))) result.Desktop = false;
            if (args.Any(arg => string.Equals(arg, "--no-start-menu", StringComparison.OrdinalIgnoreCase))) result.StartMenu = false;
            if (string.IsNullOrWhiteSpace(result.Target)) result.Target = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Cypher");
            return result;
        }
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
            CloseCypher();
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
                                progress(5 + (int)(completed * 82.0 / files.Length), "Instalando arquivos do navegador · " + completed + " de " + files.Length);
                        }
                    }
                }
                if (!File.Exists(Path.Combine(staging, "Cypher.exe"))) throw new InvalidDataException("Não foi possível validar os arquivos instalados.");
                progress(90, "Preparando atalhos e preferências do sistema");
                if (Directory.Exists(target))
                {
                    if (!File.Exists(Path.Combine(target, "Cypher.exe")) && Directory.EnumerateFileSystemEntries(target).Any())
                        throw new IOException("A pasta escolhida contém arquivos que não pertencem ao Cypher. Escolha uma pasta vazia ou a instalação existente.");
                    Directory.Move(target, backup);
                    movedOld = true;
                }
                Directory.Move(staging, target);
                RegisterInstallation(target, options);
                progress(100, "Cypher está pronto para abrir");
                if (options.Silent && !options.DeferLaunch && (options.ForceRun || options.Updated)) StartCypher(target, options.Updated);
                if (movedOld) TryDelete(backup);
                return true;
            }
            catch
            {
                TryDelete(staging);
                if (movedOld && Directory.Exists(backup))
                {
                    if (Directory.Exists(target)) TryDelete(target);
                    if (!Directory.Exists(target)) Directory.Move(backup, target);
                }
                throw;
            }
        }

        public static void EnsureValidTarget(string target)
        {
            if (string.IsNullOrWhiteSpace(target) || target.Length < 5 || target.IndexOfAny(Path.GetInvalidPathChars()) >= 0)
                throw new InvalidOperationException("Escolha uma pasta de instalação válida.");
            string root = Path.GetPathRoot(target);
            if (string.Equals(target.TrimEnd('\\'), root.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("O Cypher não pode ser instalado na raiz do disco.");
        }

        private static bool NeedsElevation(string target)
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
                Arguments = "/S " + (options.ForceRun ? "--force-run " : "") + (options.Updated ? "--updated " : "") + (options.WaitForProcessId > 0 ? "--wait-for-process=" + options.WaitForProcessId + " " : "") + (options.Desktop ? "" : "--no-desktop ") + (options.StartMenu ? "" : "--no-start-menu ") + (!options.Silent ? "--defer-launch " : "") + "--target " + Quote(target)
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

        private static void CloseCypher()
        {
            var closeRequested = new HashSet<int>();
            DateTime deadline = DateTime.UtcNow.AddSeconds(30);
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
                            if (process.MainWindowHandle != IntPtr.Zero && closeRequested.Add(process.Id)) process.CloseMainWindow();
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
            if (stillRunning) throw new InvalidOperationException("O Cypher ainda está finalizando. Feche todas as janelas e tente novamente.");
        }

        private static void RegisterInstallation(string target, SetupOptions options)
        {
            string executable = Path.Combine(target, "Cypher.exe");
            string uninstaller = Path.Combine(target, "CypherUninstaller.exe");
            RemoveLegacyUninstallEntries();
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Cypher"))
            {
                key.SetValue("InstallLocation", target);
                key.SetValue("CreateDesktopShortcut", options.Desktop ? 1 : 0, RegistryValueKind.DWord);
                key.SetValue("CreateStartMenuShortcut", options.StartMenu ? 1 : 0, RegistryValueKind.DWord);
            }
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\CypherURL")) { key.SetValue("", "Cypher URL"); key.SetValue("URL Protocol", ""); }
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\CypherURL\DefaultIcon")) key.SetValue("", executable + ",0");
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\CypherURL\shell\open\command")) key.SetValue("", Quote(executable) + " \"%1\"");
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Cypher\Capabilities"))
            {
                key.SetValue("ApplicationName", "Cypher"); key.SetValue("ApplicationDescription", "Navegador Cypher"); key.SetValue("ApplicationIcon", executable + ",0");
            }
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Cypher\Capabilities\URLAssociations"))
            { key.SetValue("http", "CypherURL"); key.SetValue("https", "CypherURL"); }
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\RegisteredApplications")) key.SetValue("Cypher", @"Software\Cypher\Capabilities");
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Cypher"))
            {
                key.SetValue("DisplayName", "Cypher"); key.SetValue("DisplayVersion", ProductVersion()); key.SetValue("Publisher", "Cypher");
                key.SetValue("InstallLocation", target); key.SetValue("DisplayIcon", executable + ",0");
                key.SetValue("UninstallString", Quote(uninstaller)); key.SetValue("NoModify", 1, RegistryValueKind.DWord); key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
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

        public static void LaunchInstalledCypher(string target, bool updated) { StartCypher(target, updated); }

        private static void StartCypher(string target, bool updated)
        {
            string app = Path.Combine(target, "Cypher.exe");
            if (!File.Exists(app)) throw new FileNotFoundException("Os arquivos do Cypher não foram encontrados.", app);
            Process.Start(new ProcessStartInfo(app) { WorkingDirectory = target, Arguments = updated ? "--updated" : "", UseShellExecute = true });
        }

        internal static void TryDelete(string path) { try { if (Directory.Exists(path)) Directory.Delete(path, true); else if (File.Exists(path)) File.Delete(path); } catch { } }
        internal static void TryDeleteFile(string path) { try { if (File.Exists(path)) File.Delete(path); } catch { } }
    }

    internal sealed class SetupWindow : Form
    {
        private readonly SetupOptions options;
        private readonly Panel stage;
        private readonly Panel content;
        private readonly Label stageLabel, statusLabel, progressText;
        private readonly TextBox pathBox;
        private readonly CheckBox desktopBox, startMenuBox, launchBox;
        private readonly Panel progressBar;
        private int currentPage;
        private bool installed;
        private readonly AccentButton backButton, nextButton;
        public static bool LaunchWhenDone = true;

        public SetupWindow(SetupOptions setupOptions)
        {
            options = setupOptions;
            Text = "Cypher Setup"; AutoScaleMode = AutoScaleMode.Dpi; AutoScaleDimensions = new SizeF(96f, 96f); ClientSize = new Size(920, 590); MinimumSize = Size; MaximumSize = Size; FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen; BackColor = CypherStyle.Background; DoubleBuffered = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            stage = new Panel { Bounds = new Rectangle(0, 0, 286, 590) };
            stage.Paint += delegate(object sender, PaintEventArgs e) { CypherStyle.DrawSidebar(e.Graphics, stage.Height); CypherStyle.DrawMark(e.Graphics, new Rectangle(26, 29, 33, 33), CypherStyle.Accent); };
            Controls.Add(stage);
            var brand = CypherStyle.Label("CYPHER", 15, CypherStyle.Text, FontStyle.Bold); brand.Location = new Point(70, 29); brand.Size = new Size(160, 30); stage.Controls.Add(brand);
            var edition = CypherStyle.Label("EXPERIÊNCIA DE INSTALAÇÃO  /  WINDOWS", 7.2f, CypherStyle.Muted, FontStyle.Bold); edition.Location = new Point(27, 74); edition.Size = new Size(247, 22); stage.Controls.Add(edition);
            stageLabel = CypherStyle.Label("01     BOAS-VINDAS", 8, CypherStyle.Accent, FontStyle.Bold); stageLabel.Location = new Point(27, 112); stageLabel.Size = new Size(225, 20); stage.Controls.Add(stageLabel);
            var sideTitle = CypherStyle.Label("Seu espaço.\nSuas regras.", 21, CypherStyle.Text, FontStyle.Bold); sideTitle.Location = new Point(27, 391); sideTitle.Size = new Size(230, 62); stage.Controls.Add(sideTitle);
            var sideCopy = CypherStyle.Label("Um navegador feito para\nacompanhar o seu ritmo.", 10, CypherStyle.Muted, FontStyle.Regular); sideCopy.Location = new Point(29, 464); sideCopy.Size = new Size(225, 43); stage.Controls.Add(sideCopy);
            var sideVersion = CypherStyle.Label("CYPHER  ·  " + SetupMetadata.Version, 7.5f, Color.FromArgb(108, 127, 112), FontStyle.Bold); sideVersion.Location = new Point(28, 548); sideVersion.Size = new Size(230, 18); stage.Controls.Add(sideVersion);

            var top = new Panel { Bounds = new Rectangle(286, 0, 634, 52), BackColor = Color.FromArgb(11, 16, 13) }; Controls.Add(top);
            top.MouseDown += DragWindow;
            var topName = CypherStyle.Label("CYPHER   /   INSTALADOR", 8, CypherStyle.Muted, FontStyle.Bold); topName.Location = new Point(26, 18); topName.Size = new Size(300, 20); top.Controls.Add(topName);
            var close = CypherStyle.Label("×", 18, CypherStyle.Muted, FontStyle.Regular); close.Location = new Point(588, 10); close.Size = new Size(28, 30); close.TextAlign = ContentAlignment.MiddleCenter; close.Cursor = Cursors.Hand; close.Click += delegate { Close(); }; top.Controls.Add(close);
            content = new Panel { Bounds = new Rectangle(286, 52, 634, 465), BackColor = CypherStyle.Background }; Controls.Add(content);

            var footer = new Panel { Bounds = new Rectangle(286, 517, 634, 73), BackColor = Color.FromArgb(12, 17, 14) }; Controls.Add(footer);
            statusLabel = CypherStyle.Label("INSTALAÇÃO LOCAL  ·  SEUS DADOS FICAM NO SEU DISPOSITIVO", 7.3f, CypherStyle.Muted, FontStyle.Bold); statusLabel.Location = new Point(25, 26); statusLabel.Size = new Size(365, 20); footer.Controls.Add(statusLabel);
            backButton = new AccentButton { Text = "VOLTAR", Bounds = new Rectangle(408, 17, 94, 40) }; backButton.Click += delegate { ShowPage(1); }; footer.Controls.Add(backButton);
            nextButton = new AccentButton { Text = "COMEÇAR", Primary = true, Bounds = new Rectangle(512, 17, 98, 40) }; nextButton.Click += Next; footer.Controls.Add(nextButton);

            pathBox = new TextBox { Bounds = new Rectangle(0, 0, 400, 32), BorderStyle = BorderStyle.FixedSingle, BackColor = CypherStyle.PanelRaised, ForeColor = CypherStyle.Text, Font = new Font("Segoe UI", 9.5f), Text = options.Target };
            desktopBox = MakeCheck("Criar atalho na área de trabalho", true);
            startMenuBox = MakeCheck("Adicionar ao menu Iniciar", true);
            launchBox = MakeCheck("Abrir o Cypher ao concluir", true);
            progressBar = new Panel { Bounds = new Rectangle(0, 0, 0, 6), BackColor = CypherStyle.Accent };
            progressText = CypherStyle.Label("0%", 8, CypherStyle.Accent, FontStyle.Bold);
            ShowPage(0);
        }

        private static CheckBox MakeCheck(string text, bool check)
        {
            return new CheckBox { Text = text, Checked = check, AutoSize = false, Size = new Size(550, 32), BackColor = Color.Transparent, ForeColor = CypherStyle.Text, Font = new Font("Segoe UI", 9.5f), FlatStyle = FlatStyle.Standard, UseCompatibleTextRendering = false, CheckAlign = ContentAlignment.MiddleLeft, TextAlign = ContentAlignment.MiddleLeft, Cursor = Cursors.Hand, TabStop = true, Padding = new Padding(1, 0, 0, 0) };
        }

        private void DragWindow(object sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            ReleaseCapture(); SendMessage(Handle, 0xA1, new IntPtr(2), IntPtr.Zero);
        }

        [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

        private void ShowPage(int page)
        {
            currentPage = page; content.Controls.Clear();
            stageLabel.Text = page == 0 ? "01     BOAS-VINDAS" : page == 1 ? "02     PREFERÊNCIAS" : page == 2 ? "03     INSTALAÇÃO" : "04     CONCLUÍDO";
            backButton.Visible = page == 1; nextButton.Visible = page != 2;
            nextButton.Text = page == 0 ? "COMEÇAR" : page == 1 ? "INSTALAR" : page == 3 ? "CONCLUIR" : "AVANÇAR";
            nextButton.Enabled = page != 2;
            if (page == 0) BuildWelcome();
            if (page == 1) BuildDestination();
            if (page == 2) BuildProgress();
            if (page == 3) BuildComplete();
        }

        private void BuildWelcome()
        {
            AddKicker("INSTALADOR OFICIAL   /   CYPHER FOR WINDOWS", 28, 34);
            var heading = CypherStyle.Label("Um jeito novo de\nnavegar começa aqui.", 24, CypherStyle.Text, FontStyle.Bold); heading.Location = new Point(27, 70); heading.Size = new Size(560, 74); content.Controls.Add(heading);
            var copy = CypherStyle.Label("O Cypher combina privacidade, liberdade e uma interface que\nvocê pode moldar do seu jeito. Vamos preparar tudo no seu PC.", 10, CypherStyle.Muted, FontStyle.Regular); copy.Location = new Point(29, 163); copy.Size = new Size(550, 46); content.Controls.Add(copy);
            var cards = new[] { new[] { "01", "SUA INTERFACE", "Um espaço que acompanha você." }, new[] { "02", "SEU CONTROLE", "Preferências salvas no seu PC." }, new[] { "03", "SEM COMPLICAÇÃO", "Instale, abra e comece a navegar." } };
            for (int i = 0; i < cards.Length; i++)
            {
                int y = 244 + i * 61;
                var card = new Panel { Bounds = new Rectangle(27, y, 560, 49), BackColor = CypherStyle.Panel };
                card.Paint += delegate(object sender, PaintEventArgs e) { using (var pen = new Pen(CypherStyle.Border)) e.Graphics.DrawRectangle(pen, 0, 0, card.Width - 1, card.Height - 1); };
                var number = CypherStyle.Label(cards[i][0], 8, CypherStyle.Accent, FontStyle.Bold); number.Location = new Point(14, 15); number.Size = new Size(33, 20); card.Controls.Add(number);
                var title = CypherStyle.Label(cards[i][1], 8, CypherStyle.Text, FontStyle.Bold); title.Location = new Point(59, 7); title.Size = new Size(220, 17); card.Controls.Add(title);
                var detail = CypherStyle.Label(cards[i][2], 8.5f, CypherStyle.Muted, FontStyle.Regular); detail.Location = new Point(59, 24); detail.Size = new Size(450, 17); card.Controls.Add(detail);
                content.Controls.Add(card);
            }
        }

        private void BuildDestination()
        {
            AddKicker("ESCOLHA  /  PASTA E ATALHOS", 28, 34);
            var heading = CypherStyle.Label("Onde o Cypher deve ficar?", 22, CypherStyle.Text, FontStyle.Bold); heading.Location = new Point(27, 69); heading.Size = new Size(565, 45); content.Controls.Add(heading);
            var copy = CypherStyle.Label("Escolha uma pasta dedicada. As configurações e os favoritos\nficam no seu perfil e serão preservados se você atualizar.", 9.7f, CypherStyle.Muted, FontStyle.Regular); copy.Location = new Point(29, 119); copy.Size = new Size(550, 43); content.Controls.Add(copy);
            var pathTitle = CypherStyle.Label("PASTA DE INSTALAÇÃO", 7.5f, CypherStyle.Accent, FontStyle.Bold); pathTitle.Location = new Point(29, 183); pathTitle.Size = new Size(300, 19); content.Controls.Add(pathTitle);
            pathBox.Location = new Point(28, 210); pathBox.Size = new Size(432, 36); content.Controls.Add(pathBox);
            var browse = new AccentButton { Text = "PROCURAR", Bounds = new Rectangle(470, 209, 116, 38) }; browse.Click += delegate { using (var dialog = new FolderBrowserDialog { Description = "Escolha a pasta onde o Cypher será instalado", SelectedPath = pathBox.Text, ShowNewFolderButton = true }) if (dialog.ShowDialog(this) == DialogResult.OK) pathBox.Text = dialog.SelectedPath; }; content.Controls.Add(browse);
            var optionsTitle = CypherStyle.Label("ATALHOS E INICIALIZAÇÃO", 7.5f, CypherStyle.Accent, FontStyle.Bold); optionsTitle.Location = new Point(29, 276); optionsTitle.Size = new Size(340, 19); content.Controls.Add(optionsTitle);
            desktopBox.Location = new Point(29, 311); content.Controls.Add(desktopBox);
            startMenuBox.Location = new Point(29, 350); content.Controls.Add(startMenuBox);
            launchBox.Location = new Point(29, 389); content.Controls.Add(launchBox);
            var note = new Panel { Bounds = new Rectangle(29, 424, 557, 35), BackColor = Color.FromArgb(15, 24, 17) };
            note.Paint += delegate(object sender, PaintEventArgs e) { using (var pen = new Pen(CypherStyle.Border)) e.Graphics.DrawRectangle(pen, 0, 0, note.Width - 1, note.Height - 1); };
            var noteText = CypherStyle.Label("Seu histórico, favoritos e configurações não serão apagados.", 8, CypherStyle.Muted, FontStyle.Regular); noteText.Location = new Point(13, 8); noteText.Size = new Size(530, 18); note.Controls.Add(noteText); content.Controls.Add(note);
        }

        private void BuildProgress()
        {
            AddKicker("CYPHER  /  INSTALADOR", 28, 46);
            var heading = CypherStyle.Label("Preparando seu espaço.", 23, CypherStyle.Text, FontStyle.Bold); heading.Location = new Point(27, 84); heading.Size = new Size(560, 46); content.Controls.Add(heading);
            var copy = CypherStyle.Label("Estamos instalando os arquivos do navegador e ajustando\nos atalhos que você escolheu.", 9.7f, CypherStyle.Muted, FontStyle.Regular); copy.Location = new Point(29, 142); copy.Size = new Size(545, 44); content.Controls.Add(copy);
            var barFrame = new Panel { Bounds = new Rectangle(29, 224, 557, 9), BackColor = CypherStyle.PanelRaised }; content.Controls.Add(barFrame);
            progressBar.Location = new Point(0, 0); progressBar.Height = 9; barFrame.Controls.Add(progressBar);
            statusLabel.Text = "PREPARANDO A INSTALAÇÃO…";
            progressText.Location = new Point(29, 251); progressText.Size = new Size(70, 20); content.Controls.Add(progressText);
            var activity = CypherStyle.Label("OS ARQUIVOS DO NAVEGADOR SÃO PREPARADOS LOCALMENTE", 7.2f, CypherStyle.Muted, FontStyle.Bold); activity.Location = new Point(29, 326); activity.Size = new Size(540, 20); content.Controls.Add(activity);
            var line = new Panel { Bounds = new Rectangle(29, 367, 557, 1), BackColor = CypherStyle.Border }; content.Controls.Add(line);
            var preserve = CypherStyle.Label("PERFIL PRESERVADO", 7.3f, CypherStyle.Accent, FontStyle.Bold); preserve.Location = new Point(29, 389); preserve.Size = new Size(175, 18); content.Controls.Add(preserve);
            var preserveCopy = CypherStyle.Label("Favoritos, histórico e configurações ficam no seu dispositivo.", 8.7f, CypherStyle.Muted, FontStyle.Regular); preserveCopy.Location = new Point(29, 409); preserveCopy.Size = new Size(545, 20); content.Controls.Add(preserveCopy);
        }

        private void BuildComplete()
        {
            AddKicker("INSTALAÇÃO CONCLUÍDA  /  CYPHER", 28, 54);
            var orb = new Panel { Bounds = new Rectangle(247, 92, 112, 112), BackColor = Color.FromArgb(22, 34, 24) };
            orb.Paint += delegate(object sender, PaintEventArgs e)
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (var p = new Pen(Color.FromArgb(60, CypherStyle.Accent), 1)) e.Graphics.DrawEllipse(p, 4, 4, 102, 102);
                using (var p = new Pen(Color.FromArgb(95, CypherStyle.Accent), 1)) e.Graphics.DrawEllipse(p, 15, 15, 80, 80);
                CypherStyle.DrawMark(e.Graphics, new Rectangle(34, 34, 47, 47), CypherStyle.Accent);
            };
            content.Controls.Add(orb);
            var heading = CypherStyle.Label("Tudo pronto.", 24, CypherStyle.Text, FontStyle.Bold); heading.Location = new Point(27, 231); heading.Size = new Size(560, 45); heading.TextAlign = ContentAlignment.MiddleCenter; content.Controls.Add(heading);
            var copy = CypherStyle.Label("O Cypher está instalado e pronto para a sua próxima sessão.", 9.6f, CypherStyle.Muted, FontStyle.Regular); copy.Location = new Point(27, 279); copy.Size = new Size(560, 26); copy.TextAlign = ContentAlignment.MiddleCenter; content.Controls.Add(copy);
            launchBox.Location = new Point(199, 339); launchBox.Checked = true; content.Controls.Add(launchBox);
            statusLabel.Text = "SEU ESPAÇO. SUAS REGRAS.";
        }

        private void AddKicker(string text, int x, int y)
        {
            var kicker = CypherStyle.Label(text, 7.5f, CypherStyle.Accent, FontStyle.Bold); kicker.Location = new Point(x, y); kicker.Size = new Size(565, 18); content.Controls.Add(kicker);
        }

        private void Next(object sender, EventArgs e)
        {
            if (currentPage == 0) { ShowPage(1); return; }
            if (currentPage == 1)
            {
                options.Target = pathBox.Text.Trim(); options.Desktop = desktopBox.Checked; options.StartMenu = startMenuBox.Checked; options.ForceRun = launchBox.Checked;
                try { SetupEngine.EnsureValidTarget(options.Target); }
                catch (Exception ex) { MessageBox.Show(this, ex.Message, "Pasta de instalação", MessageBoxButtons.OK, MessageBoxIcon.Information); return; }
                ShowPage(2); BeginInstall(); return;
            }
            if (currentPage == 3)
            {
                LaunchWhenDone = launchBox.Checked;
                try
                {
                    if (launchBox.Checked) SetupEngine.LaunchInstalledCypher(options.Target, options.Updated);
                    Close();
                }
                catch (Exception ex) { MessageBox.Show(this, ex.Message, "Cypher instalado", MessageBoxButtons.OK, MessageBoxIcon.Information); }
            }
        }

        private void BeginInstall()
        {
            backButton.Enabled = false; nextButton.Enabled = false;
            var worker = new System.ComponentModel.BackgroundWorker { WorkerReportsProgress = true };
            worker.DoWork += delegate(object sender, System.ComponentModel.DoWorkEventArgs e)
            {
                e.Result = SetupEngine.Install(options, delegate(int value, string text) { worker.ReportProgress(value, text); });
            };
            worker.ProgressChanged += delegate(object sender, System.ComponentModel.ProgressChangedEventArgs e)
            {
                progressBar.Width = Math.Max(1, 557 * e.ProgressPercentage / 100); progressText.Text = e.ProgressPercentage + "%";
                statusLabel.Text = Convert.ToString(e.UserState).ToUpperInvariant();
            };
            worker.RunWorkerCompleted += delegate(object sender, System.ComponentModel.RunWorkerCompletedEventArgs e)
            {
                if (e.Error != null)
                {
                    if (e.Error.GetBaseException() is OperationCanceledException) MessageBox.Show(this, e.Error.GetBaseException().Message, "Permissão do Windows", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    else MessageBox.Show(this, e.Error.GetBaseException().Message, "Não foi possível concluir a instalação", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    ShowPage(1); return;
                }
                installed = true; LaunchWhenDone = launchBox.Checked; ShowPage(3);
            };
            worker.RunWorkerAsync();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (currentPage == 2 && !installed && e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                return;
            }
            base.OnFormClosing(e);
        }
    }

#else
    internal sealed class UninstallerWindow : Form
    {
        private readonly CheckBox removeData;
        public UninstallerWindow()
        {
            Text = "Remover Cypher"; AutoScaleMode = AutoScaleMode.Dpi; AutoScaleDimensions = new SizeF(96f, 96f); ClientSize = new Size(560, 340); MinimumSize = Size; MaximumSize = Size; FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.CenterScreen; BackColor = CypherStyle.Background; DoubleBuffered = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            var header = new Panel { Bounds = new Rectangle(0, 0, 560, 52), BackColor = Color.FromArgb(13, 19, 15) }; Controls.Add(header);
            header.Paint += delegate(object sender, PaintEventArgs e) { CypherStyle.DrawMark(e.Graphics, new Rectangle(18, 11, 30, 30), CypherStyle.Accent); };
            var title = CypherStyle.Label("CYPHER   /   REMOÇÃO", 8, CypherStyle.Muted, FontStyle.Bold); title.Location = new Point(59, 17); title.Size = new Size(300, 20); header.Controls.Add(title);
            var close = CypherStyle.Label("×", 18, CypherStyle.Muted, FontStyle.Regular); close.Location = new Point(523, 9); close.Size = new Size(27, 30); close.TextAlign = ContentAlignment.MiddleCenter; close.Cursor = Cursors.Hand; close.Click += delegate { Close(); }; header.Controls.Add(close);
            var heading = CypherStyle.Label("Deseja remover o Cypher?", 20, CypherStyle.Text, FontStyle.Bold); heading.Location = new Point(30, 83); heading.Size = new Size(500, 39); Controls.Add(heading);
            var copy = CypherStyle.Label("O navegador e os atalhos serão removidos deste dispositivo.\nSeu perfil pessoal será preservado.", 9.4f, CypherStyle.Muted, FontStyle.Regular); copy.Location = new Point(32, 131); copy.Size = new Size(495, 48); Controls.Add(copy);
            removeData = new CheckBox { Text = "Também apagar favoritos, histórico e configurações locais", AutoSize = false, Size = new Size(490, 34), Location = new Point(32, 207), ForeColor = CypherStyle.Text, BackColor = Color.Transparent, Font = new Font("Segoe UI", 9.2f), FlatStyle = FlatStyle.Standard, UseCompatibleTextRendering = false, CheckAlign = ContentAlignment.MiddleLeft, TextAlign = ContentAlignment.MiddleLeft, Cursor = Cursors.Hand, TabStop = true };
            Controls.Add(removeData);
            var note = CypherStyle.Label("Essa opção não pode ser desfeita.", 8f, Color.FromArgb(220, 174, 116), FontStyle.Regular); note.Location = new Point(52, 232); note.Size = new Size(420, 19); Controls.Add(note);
            var cancel = new AccentButton { Text = "CANCELAR", Bounds = new Rectangle(305, 274, 105, 40) }; cancel.Click += delegate { Close(); }; Controls.Add(cancel);
            var uninstall = new AccentButton { Text = "REMOVER", Primary = true, Bounds = new Rectangle(419, 274, 108, 40) }; uninstall.Click += Remove; Controls.Add(uninstall);
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
                string script = BuildCleanupScript(location, removeData.Checked, Process.GetCurrentProcess().Id);
                string encoded = Convert.ToBase64String(Encoding.Unicode.GetBytes(script));
                Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell\\v1.0\\powershell.exe"), "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand " + encoded) { UseShellExecute = false, CreateNoWindow = true });
                Close();
            }
            catch (Exception ex) { MessageBox.Show(this, ex.Message, "Não foi possível remover o Cypher", MessageBoxButtons.OK, MessageBoxIcon.Error); }
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
            script.AppendLine("Remove-Item -LiteralPath 'HKCU:\\Software\\Cypher' -Recurse -Force -ErrorAction SilentlyContinue");
            script.AppendLine("Remove-Item -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Cypher' -Recurse -Force -ErrorAction SilentlyContinue");
            script.AppendLine("if ($removeProfile) { Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue }");
            script.AppendLine("if ($install.Length -gt 5 -and (Test-Path -LiteralPath $install)) { Remove-Item -LiteralPath $install -Recurse -Force -ErrorAction SilentlyContinue }");
            return script.ToString();
        }
    }
#endif
}
