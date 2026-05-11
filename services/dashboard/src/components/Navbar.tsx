import { NavLink } from "react-router-dom";

const LOGO = "https://i.hizliresim.com/dua7o4d.png";

export interface NavbarAlert {
  id: number;
  class_name?: string;
  confidence: number;
  detected_at: string;
  camera_id: number;
}

interface Props {
  activeAlerts?: number;
  // Search
  searchQuery?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: (e: React.FormEvent) => void;
  // Notifications
  unackedAlerts?: NavbarAlert[];
  showNotifications?: boolean;
  onToggleNotifications?: () => void;
  notifRef?: React.RefObject<HTMLDivElement | null>;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function Navbar({
  activeAlerts = 0,
  searchQuery = "",
  onSearchChange,
  onSearchSubmit,
  unackedAlerts = [],
  showNotifications = false,
  onToggleNotifications,
  notifRef,
}: Props) {
  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-border-dark px-6 sm:px-8 py-3 sticky top-0 bg-ui-dark/80 backdrop-blur-sm z-50 flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3 text-white">
          <img src={LOGO} alt="Flameye logo" className="w-6 h-6" />
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">
            Flameye AI
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
      <form
        onSubmit={onSearchSubmit ?? ((e) => e.preventDefault())}
        className="flex flex-1 justify-center px-8"
      >
        <div className="flex w-full max-w-lg h-10 rounded-lg overflow-hidden bg-background-dark">
          <div className="flex items-center pl-4 text-text-dark/60">
            <span className="material-symbols-outlined text-base">search</span>
          </div>
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="flex-1 bg-transparent text-text-dark text-sm px-3 focus:outline-none placeholder:text-text-dark/50"
            placeholder="Camera name, location or INC-###"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange?.("")}
              className="px-3 text-text-dark/40 hover:text-text-dark transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>
      </form>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {activeAlerts > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <div className="size-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-text-dark/80">Live</span>
          </div>
        )}

        {/* Notification bell */}
        <div className="relative" ref={notifRef as React.RefObject<HTMLDivElement>}>
          <button
            onClick={onToggleNotifications}
            className="flex size-10 cursor-pointer items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
          </button>
          {activeAlerts > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {activeAlerts > 9 ? "9+" : activeAlerts}
            </span>
          )}

          {/* Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 rounded-xl bg-ui-dark border border-white/10 shadow-2xl overflow-hidden z-[200]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <p className="text-sm font-bold text-white">Unacknowledged Alerts</p>
                <span className="text-xs text-text-dark/50">{unackedAlerts.length} total</span>
              </div>
              {unackedAlerts.length === 0 ? (
                <p className="text-xs text-text-dark/40 text-center py-6">All clear — no active alerts</p>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {unackedAlerts.slice(0, 15).map((a) => {
                    const conf = a.confidence;
                    const sevColor = conf >= 0.75 ? "text-red-400" : conf >= 0.45 ? "text-yellow-400" : "text-blue-400";
                    const sevIcon = conf >= 0.75 ? "local_fire_department" : conf >= 0.45 ? "warning" : "info";
                    return (
                      <NavLink
                        key={a.id}
                        to={`/alerts/${a.id}`}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 border-b border-white/5 transition-colors"
                      >
                        <span className={`material-symbols-outlined text-base mt-0.5 ${sevColor}`}>{sevIcon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {(a.class_name ?? "fire").charAt(0).toUpperCase() + (a.class_name ?? "fire").slice(1)} — Camera {a.camera_id}
                          </p>
                          <p className="text-[11px] text-text-dark/50">
                            INC-{String(a.id).padStart(3, "0")} · {(conf * 100).toFixed(0)}% · {timeAgo(a.detected_at)}
                          </p>
                        </div>
                      </NavLink>
                    );
                  })}
                </div>
              )}
              <NavLink
                to="/alerts"
                className="block text-center text-xs text-primary font-medium py-3 hover:bg-white/5 transition-colors border-t border-white/10"
              >
                View all alerts →
              </NavLink>
            </div>
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
