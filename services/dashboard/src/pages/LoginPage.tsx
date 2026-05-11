import { useState } from "react";
import { useNavigate } from "react-router-dom";

const LOGO = "https://i.hizliresim.com/dua7o4d.png";
const BG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBl2Dm4mwOhBTJXG05ES-Zg3e8CMtNRAH5MLZCioJgBguwuqr7e_kQj_hnZFZChNaUeoyzl_OqM7USQuTvjCbvO9U8eoqsQPo4ZDytSPsp-w8abHyecNL-JMhbvlV2GlOxKhHZtpeb6WrmEzC6bx8is7jx7wxByAGFGHpK8Pg54TLfOppp8w92FvJcvIko6h7zlYH84tqOHjF_LsaSL5beIe3v-ICyPesz21qMximaZIdrC-ThX9KgYNKg1-rLDx80std4RFuZXTEZB";

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // No real auth yet — navigate straight to dashboard
    setTimeout(() => navigate("/dashboard"), 600);
  }

  return (
    <div className="flex min-h-screen w-full font-display">
      {/* ── Left visual pane ──────────────────────────────── */}
      <div className="relative hidden md:flex md:w-1/2 flex-col justify-between bg-zinc-900 p-10 lg:p-14">
        <div className="absolute inset-0 z-0">
          <img
            src={BG}
            alt="Satellite thermal map"
            className="h-full w-full object-cover opacity-30"
          />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src={LOGO}
            alt="Fireye logo"
            className="h-12 w-12 rounded-full border border-white/30 object-cover"
          />
          <p className="text-white text-xl font-semibold tracking-wide">Fireye</p>
        </div>

        {/* Headline */}
        <div className="relative z-10 flex flex-col gap-3">
          <h1 className="text-white text-4xl lg:text-5xl font-black leading-tight tracking-[-0.033em]">
            AI-Powered Wildfire Intelligence
          </h1>
          <h2 className="text-zinc-300 text-base lg:text-lg font-normal leading-normal">
            Early Detection, Rapid Response
          </h2>
        </div>
      </div>

      {/* ── Right form pane ───────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-background-dark p-8 lg:p-14">
        <div className="flex w-full max-w-md flex-col gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <img
                src={LOGO}
                alt="Fireye logo"
                className="h-10 w-10 rounded-full border border-border-dark object-cover"
              />
              <p className="text-white text-2xl font-semibold tracking-wide">Fireye</p>
            </div>
            <p className="text-white text-4xl font-black leading-tight tracking-[-0.033em]">
              Welcome Back
            </p>
            <p className="text-text-dark/60 text-base font-normal leading-normal">
              Sign in to access your dashboard.
            </p>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {/* Email */}
            <label className="flex flex-col gap-2">
              <span className="text-white text-base font-medium">Email or Username</span>
              <input
                type="text"
                placeholder="Enter your email or username"
                className="w-full rounded-lg border border-border-dark bg-ui-dark text-white h-14 px-4 text-base placeholder:text-text-dark/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              />
            </label>

            {/* Password */}
            <label className="flex flex-col gap-2">
              <span className="text-white text-base font-medium">Password</span>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-border-dark bg-ui-dark text-white h-14 px-4 pr-12 text-base placeholder:text-text-dark/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute inset-y-0 right-4 flex items-center text-text-dark/50 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined">
                    {showPw ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </label>

            <div className="flex justify-end">
              <a href="#" className="text-text-dark/60 text-sm underline hover:text-primary transition-colors">
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center rounded-lg h-14 px-6 text-base font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-dark transition-all disabled:opacity-70 w-full"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="flex flex-col gap-4 items-center">
            <p className="text-text-dark/60 text-sm">
              Don't have an account?{" "}
              <a href="#" className="font-medium text-primary hover:underline">Sign Up</a>
            </p>
            <p className="text-center text-xs text-text-dark/40">
              By signing in, you agree to our{" "}
              <a href="#" className="underline hover:text-primary">Terms of Service</a>
              {" "}and{" "}
              <a href="#" className="underline hover:text-primary">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
