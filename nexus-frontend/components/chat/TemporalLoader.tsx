"use client";

import { motion, AnimatePresence } from "framer-motion";

const WORDS = ["Nexus", "is", "analyzing", "your", "repository..."];

interface TemporalLoaderProps {
  visible: boolean;
  label?: string;
}

export default function TemporalLoader({
  visible,
  label,
}: TemporalLoaderProps) {
  const words = label ? label.split(" ") : WORDS;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-start gap-3 py-2 px-1"
        >
          {/* Glowing text wave */}
          <div className="flex flex-wrap gap-1">
            {words.map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0.2, y: 4 }}
                animate={{
                  opacity: [0.3, 1, 0.3],
                  y: [2, -2, 2],
                  textShadow: [
                    "0 0 0px rgba(0,245,255,0)",
                    "0 0 12px rgba(0,245,255,0.8)",
                    "0 0 0px rgba(0,245,255,0)",
                  ],
                }}
                transition={{
                  duration: 1.8,
                  delay: i * 0.12,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: "0.75rem",
                  letterSpacing: "0.05em",
                  color: "#00f5ff",
                }}
              >
                {word}
              </motion.span>
            ))}
          </div>

          {/* Animated progress bar */}
          <div className="w-48 h-px bg-slate-800 relative overflow-hidden rounded-full">
            <motion.div
              className="absolute inset-y-0 left-0 w-1/3 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #00f5ff, #a855f7, transparent)",
              }}
              animate={{ x: ["-100%", "400%"] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>

          {/* Blinking cursor */}
          <div className="flex items-center gap-1.5">
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.65rem",
                color: "rgba(148,163,184,0.5)",
              }}
            >
              nexus@core:~$
            </span>
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{
                display: "inline-block",
                width: "6px",
                height: "12px",
                background: "#00f5ff",
                borderRadius: "1px",
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
