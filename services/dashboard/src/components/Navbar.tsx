import { NavLink } from "react-router-dom";

const LOGO = "https://i.hizliresim.com/dua7o4d.png";

interface Props {
  activeAlerts?: number;
}

export function Navbar({ activeAlerts = 0 }: Props) {
  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-border-dark px-6 sm:px-8 py-3 sticky top-0 bg-ui-dark/80 backdrop-blur-sm z-50 flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3 text-white">
          <img src={LOGO} alt="Fireye logo" className="w-6 h-6" />
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">
            Fireye AI
          </h2>
        </div>

        <nav className="hidden md:flex items-center gap-9">
          {[
            { to: "/dashboard", label: "Dashboard" },
            { to: "/alerts",    label: "Alerts" },
            { to: "/reports",   label: "Reports" },
            { to: "/cameras",   label: "Cameras" },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive
                  ? "text-primary text-sm font-bold leading-normal"
                  : "text-white/70 hover:text-white transition-colors text-sm font-medium leading-normal"
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Search */}
      <div className="flex flex-1 justify-center px-8">
        <div className="flex w-full max-w-lg h-10 rounded-lg overflow-hidden bg-background-dark">
          <div className="flex items-center pl-4 text-text-dark/60">
            <span className="material-symbols-outlined text-base">search</span>
          </div>
          <input
            className="flex-1 bg-transparent text-text-dark text-sm px-3 focus:outline-none placeholder:text-text-dark/50"
            placeholder="Search locations or incident IDs"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {activeAlerts > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <div className="size-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-text-dark/80">Live</span>
          </div>
        )}
        <div className="relative">
          <button className="flex size-10 cursor-pointer items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-xl">notifications</span>
          </button>
          {activeAlerts > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {activeAlerts > 9 ? "9+" : activeAlerts}
            </span>
          )}
        </div>
        <div
          className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-white/10"
          style={{ backgroundImage: `url('${LOGO}')` }}
        />
      </div>
    </header>
  );
}
