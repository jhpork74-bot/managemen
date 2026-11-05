using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace FacilityIdleShutdown {
    static class Program {
        [STAThread] static void Main(string[] args) {
            bool created;
            using (Mutex mutex = new Mutex(true, @"Local\FacilityIdleShutdown_v1", out created)) {
                if (!created) { MessageBox.Show("이미 실행 중입니다. 작업표시줄 오른쪽의 자동종료 아이콘을 확인하세요.", "PC 미사용 자동종료"); return; }
                Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new MainWindow(Array.IndexOf(args, "--tray") >= 0));
            }
        }
    }
    sealed class MainWindow : Form {
        [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
        [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
        [DllImport("user32.dll", SetLastError = true)] static extern bool RegisterHotKey(IntPtr handle, int id, uint modifiers, uint key);
        [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr handle, int id);
        const int ExitHotKey = 0x4F21;
        readonly NotifyIcon tray = new NotifyIcon();
        readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
        readonly Label status = new Label(), remaining = new Label();
        readonly Button toggle = new Button();
        readonly Button quit = new Button();
        readonly ToolStripMenuItem exitMenu = new ToolStripMenuItem("프로그램 종료");
        Button hideButton;
        bool exitVisible, hotKeyRegistered;
        bool armed = true, warning = false, exit = false, trayStart;
        uint resetTick, warningTick, warningInput;
        WarningWindow warningWindow;
        static uint Now { get { return unchecked((uint)Environment.TickCount); } }
        public MainWindow(bool startInTray) {
            trayStart = startInTray; resetTick = Now;
            Text = "1시간 미사용 자동종료"; Font = new Font("맑은 고딕", 11); KeyPreview = true;
            ClientSize = new Size(480, 255); AutoScaleMode = AutoScaleMode.Dpi;
            FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; StartPosition = FormStartPosition.CenterScreen;
            status.SetBounds(24, 20, 430, 32); remaining.SetBounds(24, 57, 430, 55);
            Label help = new Label { Text = "마우스·키보드 미사용 1시간 후 종료합니다.\n종료 1분 전에 안내하며 PC를 사용하면 취소됩니다.", AutoSize = false };
            help.SetBounds(24, 118, 435, 55);
            toggle.SetBounds(24, 188, 135, 42); toggle.Click += delegate { SetArmed(!armed); };
            hideButton = new Button { Text = "아이콘으로 숨기기" }; hideButton.SetBounds(170, 188, 282, 42); hideButton.Click += delegate { HideWindow(); };
            quit.Text = "종료"; quit.SetBounds(347, 188, 105, 42); quit.Visible = false; quit.Click += delegate { ExitProgram(); };
            Controls.AddRange(new Control[] { status, remaining, help, toggle, hideButton, quit });
            tray.Icon = SystemIcons.Information; tray.Text = "1시간 미사용 자동종료 · 작동 중"; tray.Visible = true;
            ContextMenuStrip menu = new ContextMenuStrip();
            menu.Items.Add("상태 보기", null, delegate { ShowWindow(); });
            menu.Items.Add("일시정지", null, delegate { SetArmed(false); });
            menu.Items.Add("다시 시작 (지금부터 1시간)", null, delegate { SetArmed(true); });
            exitMenu.Visible = false; exitMenu.Click += delegate { ExitProgram(); }; menu.Items.Add(exitMenu);
            tray.ContextMenuStrip = menu; tray.DoubleClick += delegate { ShowWindow(); };
            timer.Interval = 1000; timer.Tick += Tick; timer.Start();
            SystemEvents.PowerModeChanged += PowerChanged; SystemEvents.SessionSwitch += SessionChanged;
            UpdateStatus(0);
        }
        protected override void OnShown(EventArgs e) { base.OnShown(e); if (trayStart) { trayStart = false; Hide(); } }
        protected override void OnHandleCreated(EventArgs e) {
            base.OnHandleCreated(e);
            hotKeyRegistered = RegisterHotKey(Handle, ExitHotKey, 0x0002 | 0x4000, 0x70);
        }
        protected override void OnHandleDestroyed(EventArgs e) {
            if (hotKeyRegistered) { UnregisterHotKey(Handle, ExitHotKey); hotKeyRegistered = false; }
            base.OnHandleDestroyed(e);
        }
        protected override void WndProc(ref Message message) {
            if (message.Msg == 0x0312 && message.WParam.ToInt32() == ExitHotKey) { ToggleExitVisibility(); return; }
            base.WndProc(ref message);
        }
        protected override bool ProcessCmdKey(ref Message message, Keys keys) {
            if (keys == (Keys.Control | Keys.F1)) { ToggleExitVisibility(); return true; }
            return base.ProcessCmdKey(ref message, keys);
        }
        void SetExitVisibility(bool visible) {
            exitVisible = visible; quit.Visible = visible; exitMenu.Visible = visible;
            hideButton.Width = visible ? 165 : 282;
        }
        void ToggleExitVisibility() { SetExitVisibility(!exitVisible); ShowWindow(); }
        void HideWindow() { SetExitVisibility(false); Hide(); }
        void ShowWindow() { Show(); WindowState = FormWindowState.Normal; Activate(); }
        void SetArmed(bool enabled) { CancelWarning(); armed = enabled; resetTick = Now; UpdateStatus(0); }
        void CancelWarning() {
            warning = false;
            if (warningWindow != null) { WarningWindow old = warningWindow; warningWindow = null; old.AllowClose = true; old.Close(); old.Dispose(); }
            resetTick = Now;
        }
        void PowerChanged(object sender, PowerModeChangedEventArgs e) { if (e.Mode == PowerModes.Resume && IsHandleCreated && !IsDisposed) BeginInvoke((Action)delegate { CancelWarning(); UpdateStatus(0); }); }
        void SessionChanged(object sender, SessionSwitchEventArgs e) { if ((e.Reason == SessionSwitchReason.SessionUnlock || e.Reason == SessionSwitchReason.SessionLogon) && IsHandleCreated && !IsDisposed) BeginInvoke((Action)delegate { CancelWarning(); UpdateStatus(0); }); }
        void Tick(object sender, EventArgs e) {
            if (!armed) return;
            LASTINPUTINFO info = new LASTINPUTINFO(); info.cbSize = (uint)Marshal.SizeOf(info);
            if (!GetLastInputInfo(ref info)) { SetArmed(false); status.Text = "입력 상태 조회 실패 · 안전을 위해 일시정지"; return; }
            uint now = Now;
            if (warning) {
                if (IdlePolicy.ShouldCancel(info.dwTime, warningInput)) { CancelWarning(); UpdateStatus(0); return; }
                int seconds = IdlePolicy.RemainingSeconds(now, warningTick);
                if (warningWindow != null) warningWindow.SetSeconds(seconds);
                if (seconds == 0) RequestShutdown();
                return;
            }
            uint idle = IdlePolicy.IdleMilliseconds(now, info.dwTime, resetTick); UpdateStatus(idle);
            if (IdlePolicy.ShouldWarn(now, info.dwTime, resetTick)) {
                warning = true; warningTick = now; warningInput = info.dwTime;
                warningWindow = new WarningWindow(delegate { CancelWarning(); UpdateStatus(0); });
                warningWindow.Show(); warningWindow.Activate();
                System.Media.SystemSounds.Exclamation.Play();
            }
        }
        void UpdateStatus(uint idle) {
            status.Text = armed ? "자동종료 감시가 작동 중입니다." : "일시정지 · 자동으로 종료하지 않습니다.";
            int seconds = (int)Math.Max(0, ((long)IdlePolicy.IdleLimitMs - IdlePolicy.WarningMs - idle + 999) / 1000);
            remaining.Text = armed ? "종료 안내까지 " + (seconds / 60) + "분 " + (seconds % 60) + "초" : "다시 시작을 누르면 지금부터 계산합니다.";
            toggle.Text = armed ? "일시정지" : "다시 시작"; tray.Text = armed ? "1시간 미사용 자동종료 · 작동 중" : "1시간 미사용 자동종료 · 일시정지";
        }
        void RequestShutdown() {
            SetArmed(false);
            try {
                ProcessStartInfo start = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "shutdown.exe"), "/s /t 0");
                start.UseShellExecute = false; start.CreateNoWindow = true;
                using (Process p = Process.Start(start)) { if (p == null) throw new InvalidOperationException("종료 명령을 시작할 수 없습니다."); }
                status.Text = "Windows에 종료 요청을 보냈습니다.";
                remaining.Text = "미저장 문서 등으로 종료가 중단되면 다시 시작을 누르세요.";
            } catch (Exception e) { ShowWindow(); MessageBox.Show("종료 요청 실패: " + e.Message, Text); }
        }
        void ExitProgram() { if (!exitVisible) return; exit = true; Close(); }
        protected override void OnFormClosing(FormClosingEventArgs e) {
            if (!exit && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; HideWindow(); return; }
            timer.Stop(); CancelWarning(); tray.Visible = false; tray.Dispose(); timer.Dispose();
            SystemEvents.PowerModeChanged -= PowerChanged; SystemEvents.SessionSwitch -= SessionChanged;
            base.OnFormClosing(e);
        }
    }
    sealed class WarningWindow : Form {
        readonly Label countdown = new Label(); public bool AllowClose; readonly Action cancel;
        public WarningWindow(Action cancelAction) {
            cancel = cancelAction; Text = "PC 자동종료 예정"; Font = new Font("맑은 고딕", 12);
            AutoScaleMode = AutoScaleMode.Dpi; ClientSize = new Size(490, 220); TopMost = true;
            FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false; StartPosition = FormStartPosition.CenterScreen;
            countdown.SetBounds(24, 20, 440, 50); countdown.Font = new Font("맑은 고딕", 17, FontStyle.Bold);
            Label help = new Label { Text = "59분 동안 마우스·키보드 사용이 없었습니다.\nPC를 사용하거나 아래 취소를 누르면 종료하지 않습니다." }; help.SetBounds(24, 80, 445, 60);
            Button button = new Button { Text = "종료 취소 · 1시간 다시 시작" }; button.SetBounds(70, 155, 350, 45); button.Click += delegate { cancel(); };
            Controls.AddRange(new Control[] { countdown, help, button }); SetSeconds(60);
        }
        public void SetSeconds(int seconds) { countdown.Text = seconds + "초 뒤 PC가 종료됩니다."; }
        protected override void OnFormClosing(FormClosingEventArgs e) { if (!AllowClose && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; BeginInvoke(cancel); return; } base.OnFormClosing(e); }
    }
}

