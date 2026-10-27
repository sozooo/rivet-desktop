import { X } from "lucide-react";

/** The decorative panel beside the repository setup form. */
export function SetupArt({ onClose }: { onClose: () => void }) {
  return (
    <aside className="setup-art">
      <button
        className="setup-close icon-button"
        aria-label="Close repository setup"
        onClick={onClose}
      >
        <X />
      </button>
      <div className="art-label">
        <span className="brand-mark">r</span> MAKE ROOM FOR WHAT’S NEXT
      </div>
      <svg
        className="repo-illustration"
        viewBox="0 0 440 430"
        role="img"
        aria-label="Connected repository folders and commit paths"
      >
        <defs>
          <pattern
            id="art-grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#d4e2ba" opacity=".18" />
          </pattern>
        </defs>
        <rect width="440" height="430" fill="url(#art-grid)" />
        <ellipse
          cx="225"
          cy="365"
          rx="140"
          ry="15"
          fill="#193e35"
          opacity=".22"
        />
        <g fill="none" stroke="#d7e4bc" strokeWidth="2">
          <path
            d="M92 142V254Q92 280 120 280H218M343 120V227Q343 249 317 249H240"
            strokeDasharray="5 7"
          />
          <path d="M218 306V365M198 365H238" />
        </g>
        <g transform="translate(116 176) rotate(-7 105 70)">
          <path
            d="M0 18Q0 6 12 6H77L95 24H202Q214 24 214 36V147Q214 160 201 160H13Q0 160 0 147Z"
            fill="#aabb91"
            stroke="#183d34"
            strokeWidth="2"
          />
          <path
            d="M0 55Q0 43 13 43H201Q214 43 214 55V147Q214 160 201 160H13Q0 160 0 147Z"
            fill="#dbe6bc"
            stroke="#183d34"
            strokeWidth="2"
          />
          <path
            d="M80 84V119Q80 131 93 131H124Q137 131 137 117V99"
            fill="none"
            stroke="#356e5d"
            strokeWidth="4"
          />
          <g fill="#dbe6bc" stroke="#356e5d" strokeWidth="4">
            <circle cx="80" cy="80" r="7" />
            <circle cx="80" cy="126" r="7" />
            <circle cx="137" cy="92" r="7" />
          </g>
        </g>
        <g transform="translate(56 82) rotate(-13)">
          <rect
            width="83"
            height="72"
            rx="8"
            fill="#dbe6bc"
            stroke="#183d34"
            strokeWidth="2"
          />
          <path
            d="M18 24H63M18 35H56M18 46H45"
            stroke="#356e5d"
            strokeWidth="2"
          />
        </g>
        <g transform="translate(294 64) rotate(12)">
          <rect
            width="85"
            height="79"
            rx="9"
            fill="#dbe6bc"
            stroke="#183d34"
            strokeWidth="2"
          />
          <path
            d="M24 25L14 39L24 52M60 25L70 39L60 52M48 22L36 55"
            fill="none"
            stroke="#356e5d"
            strokeWidth="3"
          />
        </g>
        <g fill="#dbe6bc">
          <circle cx="209" cy="85" r="5" />
          <path d="M197 119H217M207 109V129" stroke="#dbe6bc" strokeWidth="2" />
        </g>
      </svg>
      <h2>
        A clearer view.
        <br />A little more flow.
      </h2>
      <p>
        Everything you need to follow your changes,
        <br />
        from the first commit to what comes next.
      </p>
      <div className="art-bottom">
        BUILT AROUND GIT <span>01 — YOUR WORKSPACE</span>
      </div>
    </aside>
  );
}
