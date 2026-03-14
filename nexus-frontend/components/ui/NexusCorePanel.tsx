"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Maximize2, ExternalLink } from "lucide-react";

interface NexusCoreProps {
  splineUrl?: string;
}

// Animated SVG fallback while Spline isn't configured
function AnimatedCoreFallback() {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Outer rings */}
      {[1, 1.6, 2.2].map((scale, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${120 * scale}px`,
            height: `${120 * scale}px`,
            border: `1px solid rgba(0,245,255,${0.25 - i * 0.06})`,
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 8 + i * 4, repeat: Infinity, ease: "linear" }}
        />
      ))}

      {/* Orbiting dot */}
      <motion.div
        className="absolute"
        style={{ width: "176px", height: "176px" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="absolute"
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#00f5ff",
            boxShadow: "0 0 10px #00f5ff",
            top: "0",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
      </motion.div>

      {/* Violet orbiting dot */}
      <motion.div
        className="absolute"
        style={{ width: "130px", height: "130px" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="absolute"
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: "#a855f7",
            boxShadow: "0 0 8px #a855f7",
            top: "0",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
      </motion.div>

      {/* Core sphere */}
      <motion.div
        animate={{
          boxShadow: [
            "0 0 20px rgba(0,245,255,0.3), 0 0 60px rgba(0,245,255,0.1)",
            "0 0 40px rgba(0,245,255,0.6), 0 0 80px rgba(0,245,255,0.2), 0 0 120px rgba(168,85,247,0.1)",
            "0 0 20px rgba(0,245,255,0.3), 0 0 60px rgba(0,245,255,0.1)",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 35%, rgba(0,245,255,0.3) 0%, rgba(168,85,247,0.2) 50%, rgba(6,13,26,0.9) 100%)",
          border: "1px solid rgba(0,245,255,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 10,
        }}
      >
        <Globe size={24} style={{ color: "#00f5ff" }} />
      </motion.div>

      {/* Scan sweep */}
      <motion.div
        className="absolute"
        style={{
          width: "220px",
          height: "220px",
          borderRadius: "50%",
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(0,245,255,0.08) 30deg, transparent 60deg)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />

      {/* Status label */}
      <div
        className="absolute bottom-6 left-0 right-0 text-center"
        style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: "0.55rem",
          letterSpacing: "0.15em",
          color: "rgba(0,245,255,0.4)",
        }}
      >
        NEXUS CORE · ACTIVE
      </div>

      {/* Hex grid overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,245,255,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,245,255,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />
    </div>
  );
}

export default function NexusCorePanel({ splineUrl }: NexusCoreProps) {
  const [showSpline, setShowSpline] = useState(!!splineUrl);
  const [splineLoaded, setSplineLoaded] = useState(false);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg scan-line-container">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,245,255,0.04) 0%, rgba(168,85,247,0.02) 40%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2.5"
        style={{
          background: "rgba(2,4,9,0.6)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(0,245,255,0.08)",
        }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{
              backgroundColor: ["rgba(0,245,255,0.8)", "rgba(168,85,247,0.8)", "rgba(0,245,255,0.8)"],
            }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{ width: "6px", height: "6px", borderRadius: "50%" }}
          />
          <span
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: "0.58rem",
              letterSpacing: "0.12em",
              color: "rgba(0,245,255,0.7)",
            }}
          >
            3D CORE VISUALIZATION
          </span>
        </div>

        <div className="flex items-center gap-2">
          {splineUrl && (
            <button
              onClick={() => setShowSpline((s) => !s)}
              className="btn-cyber py-1 px-2"
              style={{ fontSize: "0.5rem" }}
            >
              {showSpline ? "FALLBACK" : "3D MODE"}
            </button>
          )}
          {splineUrl && (
            <a
              href={splineUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "rgba(0,245,255,0.4)", display: "flex" }}
            >
              <ExternalLink size={11} />
            </a>
          )}
          <Maximize2 size={11} style={{ color: "rgba(148,163,184,0.3)", cursor: "pointer" }} />
        </div>
      </div>

      {/* Core Visualization */}
      <div className="absolute inset-0 pt-10">
        {showSpline && splineUrl ? (
          <>
            {!splineLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <AnimatedCoreFallback />
              </div>
            )}
            <iframe
              src={splineUrl}
              onLoad={() => setSplineLoaded(true)}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                opacity: splineLoaded ? 1 : 0,
                transition: "opacity 0.5s ease",
              }}
              title="Nexus 3D Core"
              allow="autoplay"
            />
          </>
        ) : (
          <AnimatedCoreFallback />
        )}
      </div>

      {/* Corner decorations */}
      {["top-10 left-0", "top-10 right-0", "bottom-0 left-0", "bottom-0 right-0"].map(
        (pos, i) => (
          <div
            key={i}
            className={`absolute ${pos} w-4 h-4`}
            style={{
              borderTop: i < 2 ? "1px solid rgba(0,245,255,0.3)" : "none",
              borderBottom: i >= 2 ? "1px solid rgba(0,245,255,0.3)" : "none",
              borderLeft: i % 2 === 0 ? "1px solid rgba(0,245,255,0.3)" : "none",
              borderRight: i % 2 === 1 ? "1px solid rgba(0,245,255,0.3)" : "none",
            }}
          />
        )
      )}
    </div>
  );
}
