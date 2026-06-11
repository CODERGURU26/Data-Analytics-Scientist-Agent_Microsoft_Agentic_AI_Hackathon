import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;
const BACKGROUND_VIDEO_URL =
  "https://videos.cdn.sap.com/vod/2018/project-intelligence-network-for-construction.mp4";

const bootLines = [
  "INITIALIZING INSIGHTAI...",
  "Loading reasoning engine...",
  "Connecting analytical modules...",
  "Activating intelligence network...",
  "System Ready.",
];

const scrollStages = [
  "Dataset",
  "Understanding",
  "Analysis",
  "Reasoning",
  "Insights",
  "Strategy",
  "Executive Report",
];

const PAGE_CONTAINER =
  "mx-auto max-w-[1440px] px-6";
const SECTION_STACK = "py-32";

export default function HomePage() {
  const { scrollYProgress } = useScroll();
  const heroRef = useRef<HTMLDivElement | null>(null);
  const introTimer = useRef<number | null>(null);
  const [bootComplete, setBootComplete] = useState(false);
  const [bootIndex, setBootIndex] = useState(0);
  const [hover, setHover] = useState({ x: 0.5, y: 0.5 });
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 120, damping: 22 });
  const springY = useSpring(y, { stiffness: 120, damping: 22 });
  const parallaxX = useTransform(springX, [0, 1], [-28, 28]);
  const parallaxY = useTransform(springY, [0, 1], [-20, 20]);
  const networkOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0.72]);
  const stageActive = Math.min(
    scrollStages.length - 1,
    Math.floor(scrollYProgress.get() * scrollStages.length),
  );

  useEffect(() => {
    bootLines.forEach((_, index) => {
      window.setTimeout(() => setBootIndex(index), 900 + index * 850);
    });
    introTimer.current = window.setTimeout(
      () => setBootComplete(true),
      900 + bootLines.length * 850 + 300,
    );
    return () => {
      if (introTimer.current) window.clearTimeout(introTimer.current);
    };
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const bounds = heroRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const nextX = (event.clientX - bounds.left) / bounds.width;
    const nextY = (event.clientY - bounds.top) / bounds.height;
    setHover({ x: nextX, y: nextY });
    x.set(nextX);
    y.set(nextY);
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#05070B] text-[var(--text-primary)]">
      <HeroBackground
        parallaxX={parallaxX}
        parallaxY={parallaxY}
        opacity={networkOpacity}
        hover={hover}
      />

      {!bootComplete && <BootSequence activeIndex={bootIndex} />}

      <main
        className={`relative z-10 transition-opacity duration-700 ${bootComplete ? "opacity-100" : "opacity-0"}`}
      >
        <section
          ref={heroRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => {
            x.set(0.5);
            y.set(0.5);
            setHover({ x: 0.5, y: 0.5 });
          }}
          className="relative min-h-screen overflow-hidden"
        >
          <div className={`${PAGE_CONTAINER} flex min-h-screen items-center ${SECTION_STACK}`}>
            <div className="grid w-full items-center gap-6 lg:grid-cols-12">
              <div className="max-w-4xl lg:col-span-7">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{
                    opacity: bootComplete ? 1 : 0,
                    y: bootComplete ? 0 : 18,
                  }}
                  transition={{ duration: 0.8, ease }}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(198,168,106,0.35)] bg-[rgba(198,168,106,0.06)] px-4 py-2 text-xs uppercase tracking-[0.34em] text-[var(--accent)]"
                >
                  <Sparkles className="h-4 w-4" />
                  Autonomous Intelligence System
                </motion.div>

                <div className="mt-10 max-w-[760px] space-y-3 md:mt-14">
                  {[
                    "Watch AI.",
                    "Think Through Data",
                    "In InsightAI.",
                  ].map((line, index) => (
                    <motion.h1
                      key={line}
                      initial={{ opacity: 0, y: 28 }}
                      animate={{
                        opacity: bootComplete ? 1 : 0,
                        y: bootComplete ? 0 : 28,
                      }}
                      transition={{ duration: 1, delay: index * 0.12, ease }}
                      className="max-w-[680px] font-heading text-[clamp(3rem,6.2vw,5.8rem)] leading-[0.96] tracking-[-0.06em]"
                    >
                      {line}
                    </motion.h1>
                  ))}
                </div>

                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{
                    opacity: bootComplete ? 1 : 0,
                    y: bootComplete ? 0 : 18,
                  }}
                  transition={{ duration: 0.9, delay: 0.6, ease }}
                  className="mt-8 max-w-2xl text-base leading-8 text-[var(--text-secondary)] md:text-lg"
                >
                  Watch AI uncover patterns in raw data, translate evidence into
                  business meaning, and assemble an executive report before your
                  eyes.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{
                    opacity: bootComplete ? 1 : 0,
                    y: bootComplete ? 0 : 18,
                  }}
                  transition={{ duration: 0.9, delay: 0.75, ease }}
                  className="mt-10 flex flex-col items-start gap-4 sm:flex-row"
                >
                  <a
                    href="/console"
                    className="group inline-flex items-center gap-3 rounded-full bg-[var(--accent)] px-7 py-4 text-base font-medium text-[#0A0D12] shadow-[0_0_40px_rgba(198,168,106,0.24)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_56px_rgba(198,168,106,0.35)]"
                  >
                    Launch Intelligence System
                    <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </a>
                </motion.div>
              </div>

              <div className="lg:col-span-5 lg:justify-self-end">
                <IntelligenceCore hover={hover} />
              </div>
            </div>
          </div>

          <FloatingMetrics />
        </section>

        <section className={`${PAGE_CONTAINER} pb-32`}>
          <motion.div
            style={{
              opacity: useTransform(scrollYProgress, [0.05, 0.18], [1, 0.72]),
            }}
            className="overflow-hidden rounded-[36px] border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,rgba(12,16,22,0.84),rgba(17,22,29,0.86))] px-6 py-8 md:px-8 md:py-10"
          >
            <ScrollMap stageActive={stageActive} />
          </motion.div>
        </section>
      </main>
    </div>
  );
}

function BootSequence({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#05070B]">
      <div className="w-[min(780px,calc(100%-32px))] rounded-[28px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.34em] text-[var(--accent)]">
          Boot Sequence
        </p>
        <div className="mt-6 space-y-3 font-mono text-sm leading-7 text-[rgba(245,247,250,0.8)] md:text-base">
          {bootLines.map((line, index) => (
            <motion.div
              key={line}
              initial={{ opacity: 0 }}
              animate={{ opacity: index <= activeIndex ? 1 : 0.22 }}
              transition={{ duration: 0.35 }}
            >
              <span className="text-[var(--accent)]">&gt;</span> {line}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntelligenceCore({ hover }: { hover: { x: number; y: number } }) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const nodes = [
    {
      label: "+17% Revenue Opportunity",
      angle: 20,
      radius: 240,
      insight: "Revenue opportunity",
    },
    {
      label: "94% Confidence",
      angle: 90,
      radius: 180,
      insight: "High confidence",
    },
    {
      label: "Classification Detected",
      angle: 160,
      radius: 240,
      insight: "Classification problem",
    },
    {
      label: "Strong Correlation",
      angle: 230,
      radius: 180,
      insight: "Strong correlation",
    },
    {
      label: "3 Anomalies Found",
      angle: 300,
      radius: 240,
      insight: "Anomaly cluster",
    },
    {
      label: "Model Recommended",
      angle: 350,
      radius: 180,
      insight: "Model recommendation",
    },
  ];
  const connections = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 0],
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease }}
      className="relative mx-auto flex w-full max-w-[760px] items-center justify-center lg:mx-0 lg:w-[46%]"
    >
      <div className="relative h-[760px] w-full min-w-[580px] max-lg:min-w-0 max-lg:h-[640px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(198,168,106,0.08),transparent_24%),radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_54%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_44%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgba(198,168,106,0.4)_1px,transparent_1px)] [background-size:32px_32px]" />

        <motion.div
          className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(198,168,106,0.28)_0%,rgba(198,168,106,0.15)_22%,rgba(198,168,106,0.05)_48%,transparent_76%)] blur-3xl"
          animate={{
            scale: [0.985, 1.015, 0.985],
            opacity: [0.72, 0.96, 0.72],
          }}
          transition={{
            duration: 12,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(198,168,106,0.18)] bg-[radial-gradient(circle,rgba(198,168,106,0.06)_0%,rgba(198,168,106,0.018)_44%,rgba(5,7,11,0.12)_100%)]"
          animate={{ rotate: -360 }}
          transition={{
            duration: 72,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        />

        <svg className="absolute inset-0 h-full w-full">
          {connections.map(([from, to], index) => {
            const a = nodes[from];
            const b = nodes[to];
            const ax =
              50 + Math.cos((a.angle * Math.PI) / 180) * (a.radius / 10);
            const ay =
              50 + Math.sin((a.angle * Math.PI) / 180) * (a.radius / 10);
            const bx =
              50 + Math.cos((b.angle * Math.PI) / 180) * (b.radius / 10);
            const by =
              50 + Math.sin((b.angle * Math.PI) / 180) * (b.radius / 10);
            return (
              <g key={`${from}-${to}`}>
                <line
                  x1={`${ax}%`}
                  y1={`${ay}%`}
                  x2="50%"
                  y2="50%"
                  stroke="rgba(198,168,106,0.12)"
                  strokeWidth="1"
                />
                <motion.circle
                  r="4"
                  fill="rgba(198,168,106,0.82)"
                  initial={{
                    opacity: 0,
                    cx: `${50 + (ax - 50) * 0.18}%`,
                    cy: `${50 + (ay - 50) * 0.18}%`,
                  }}
                  animate={{
                    opacity: [0, 0.85, 0],
                    cx: [
                      `${50 + (ax - 50) * 0.12}%`,
                      `${50 + (ax - 50) * 0.9}%`,
                    ],
                    cy: [
                      `${50 + (ay - 50) * 0.12}%`,
                      `${50 + (ay - 50) * 0.9}%`,
                    ],
                  }}
                  transition={{
                    duration: 12 + index * 0.8,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                    delay: index * 0.9,
                  }}
                />
                <line
                  x1={`${bx}%`}
                  y1={`${by}%`}
                  x2="50%"
                  y2="50%"
                  stroke="rgba(198,168,106,0.06)"
                  strokeWidth="1"
                />
              </g>
            );
          })}
        </svg>

        <div className="absolute inset-0">
          {nodes.map((node, index) => {
            const dx = (hover.x - 0.5) * 10;
            const dy = (hover.y - 0.5) * 10;
            return (
              <motion.div
                key={node.label}
                className="absolute left-1/2 top-1/2"
                animate={{ rotate: node.angle + 360 }}
                transition={{
                  duration: 84 + index * 4,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }}
                onHoverStart={() => setActiveLabel(node.insight)}
                onHoverEnd={() => setActiveLabel(null)}
                style={{ transformOrigin: "center center" }}
              >
                <motion.button
                  type="button"
                  className="group absolute -translate-y-1/2"
                  style={{ transform: `translateX(${node.radius}px)` }}
                  animate={{ x: dx, y: dy, scale: [1, 1.01, 1] }}
                  transition={{
                    duration: 14,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                >
                  <div className="relative flex h-[100px] w-[100px] items-center justify-center">
                    <motion.div
                      className="absolute inset-0 rounded-full border border-[rgba(198,168,106,0.16)] bg-[radial-gradient(circle,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] shadow-[0_0_24px_rgba(198,168,106,0.1)] backdrop-blur-sm"
                      animate={{
                        boxShadow: [
                          "0 0 0 0 rgba(198,168,106,0.03)",
                          "0 0 0 12px rgba(198,168,106,0)",
                          "0 0 0 0 rgba(198,168,106,0.03)",
                        ],
                      }}
                      transition={{
                        duration: 16 + index * 0.3,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                    />
                    <div className="absolute inset-[-10px] rounded-full border border-[rgba(198,168,106,0.08)] opacity-0 blur-sm transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="relative z-10 text-center">
                      <div className="rounded-full border border-[rgba(198,168,106,0.16)] bg-[rgba(5,7,11,0.34)] px-3 py-1 text-[12px] leading-none text-[var(--accent)]">
                        {node.label}
                      </div>
                    </div>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{
                      opacity: activeLabel === node.insight ? 1 : 0,
                      y: activeLabel === node.insight ? 0 : 8,
                      scale: activeLabel === node.insight ? 1 : 0.96,
                    }}
                    transition={{ duration: 0.25 }}
                    className="pointer-events-none absolute left-1/2 top-full mt-3 w-max -translate-x-1/2 rounded-full border border-[rgba(198,168,106,0.18)] bg-[rgba(5,7,11,0.74)] px-3 py-2 text-[10px] uppercase tracking-[0.26em] text-[var(--text-primary)] shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-md"
                  >
                    {node.insight}
                  </motion.div>
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="flex h-[520px] w-[520px] items-center justify-center rounded-full border border-[rgba(198,168,106,0.22)] bg-[radial-gradient(circle,rgba(198,168,106,0.18)_0%,rgba(198,168,106,0.09)_25%,rgba(5,7,11,0.1)_58%,rgba(5,7,11,0.02)_100%)] text-center shadow-[0_0_140px_rgba(198,168,106,0.2)]"
            animate={{ scale: [0.99, 1.01, 0.99] }}
            transition={{
              duration: 14,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          >
            <div>
              <div className="text-[12px] uppercase tracking-[0.42em] text-[rgba(245,247,250,0.66)]">
                AUTONOMOUS
              </div>
              <div className="mt-4 font-heading text-[clamp(3.4rem,5vw,4.8rem)] font-medium leading-[0.95] tracking-[-0.04em] text-[var(--text-primary)]">
                REASONING
                <br />
                ENGINE
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function ScrollMap({ stageActive }: { stageActive: number }) {
  return (
    <div className="space-y-4">
      {scrollStages.map((stage, index) => (
        <motion.div
          key={stage}
          animate={{
            opacity: index <= stageActive ? 1 : 0.32,
            scale: index === stageActive ? 1.01 : 1,
          }}
          transition={{ duration: 0.45 }}
          className="flex items-center gap-4 rounded-[24px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-5 py-4"
        >
          <div
            className={`h-3 w-3 rounded-full ${index <= stageActive ? "bg-[var(--accent)] shadow-[0_0_18px_rgba(198,168,106,0.9)]" : "bg-[rgba(255,255,255,0.2)]"}`}
          />
          <div className="font-heading text-2xl tracking-[-0.03em]">
            {stage}
          </div>
          {index < scrollStages.length - 1 && (
            <div className="ml-auto h-px flex-1 bg-[linear-gradient(90deg,rgba(198,168,106,0.35),transparent)]" />
          )}
        </motion.div>
      ))}
    </div>
  );
}

function FloatingMetrics() {
  const metrics = [
    "+14% Retention Opportunity",
    "92/100 Dataset Health",
    "High Confidence Prediction",
    "Classification Problem Detected",
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric}
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: [0, 1, 0],
            y: [0, -18, -28],
            x: index % 2 === 0 ? [0, 12, 0] : [0, -12, 0],
          }}
          transition={{
            duration: 10 + index,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: index * 1.6,
          }}
          className="absolute rounded-full border border-[rgba(198,168,106,0.24)] bg-[rgba(255,255,255,0.035)] px-4 py-2 text-xs uppercase tracking-[0.28em] text-[var(--text-primary)] backdrop-blur-md"
          style={{
            left: `${12 + index * 20}%`,
            top: `${18 + index * 14}%`,
          }}
        >
          {metric}
        </motion.div>
      ))}
    </div>
  );
}

function HeroBackground({
  parallaxX,
  parallaxY,
  opacity,
  hover,
}: {
  parallaxX: MotionValue<number>;
  parallaxY: MotionValue<number>;
  opacity: MotionValue<number>;
  hover: { x: number; y: number };
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        style={{ x: parallaxX, y: parallaxY, opacity }}
        className="absolute inset-0"
      >
        <video
          src={BACKGROUND_VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-[0.24]"
        />
      </motion.div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,#05070B_0%,rgba(5,7,11,0.72)_30%,rgba(5,7,11,0.15)_60%,#05070B_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_18%,rgba(5,7,11,0.4)_75%,rgba(5,7,11,0.78)_100%)]" />
      <div className="intelligence-grid absolute inset-0 opacity-35" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22%3E%3Cfilter id=%22n%22 x=%220%22 y=%220%22 width=%22100%25%22 height=%22100%25%22%3E%3CfeTurbulence baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22200%22 height=%22200%22 filter=%22url(%23n)%22 opacity=%220.18%22/%3E%3C/svg%3E')] opacity-[0.18] mix-blend-screen" />
      <NetworkNodes hover={hover} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  );
}

function NetworkNodes({ hover }: { hover: { x: number; y: number } }) {
  const nodes = [
    { x: 10, y: 18 },
    { x: 24, y: 28 },
    { x: 42, y: 14 },
    { x: 58, y: 30 },
    { x: 76, y: 18 },
    { x: 18, y: 58 },
    { x: 38, y: 52 },
    { x: 56, y: 64 },
    { x: 82, y: 60 },
    { x: 48, y: 82 },
  ];

  return (
    <div className="absolute inset-0">
      {nodes.map((node, index) => (
        <motion.div
          key={`${node.x}-${node.y}`}
          animate={{
            x: (hover.x - 0.5) * (index % 2 === 0 ? 24 : -18),
            y: (hover.y - 0.5) * (index % 3 === 0 ? 18 : -12),
            opacity: [0.4, 0.85, 0.4],
          }}
          transition={{
            duration: 5.5 + index * 0.2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
          className="absolute"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
        >
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_18px_rgba(198,168,106,0.9)]" />
        </motion.div>
      ))}
      <svg className="absolute inset-0 h-full w-full">
        {[
          [0, 1],
          [1, 2],
          [1, 6],
          [2, 3],
          [3, 4],
          [5, 6],
          [6, 7],
          [7, 8],
          [7, 9],
        ].map(([a, b], index) => (
          <motion.line
            key={`${a}-${b}`}
            x1={`${nodes[a].x}%`}
            y1={`${nodes[a].y}%`}
            x2={`${nodes[b].x}%`}
            y2={`${nodes[b].y}%`}
            stroke="rgba(198,168,106,0.22)"
            strokeWidth="1"
            strokeDasharray="3 8"
            initial={{ pathLength: 0.2, opacity: 0.12 }}
            animate={{ pathLength: 1, opacity: [0.12, 0.4, 0.12] }}
            transition={{
              duration: 8 + index,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>
    </div>
  );
}
