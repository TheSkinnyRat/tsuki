import { auth, signIn } from "@/auth.ts";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { Faq, type FaqEntry } from "@/components/landing/Faq.tsx";
import { MotionToggle } from "@/components/landing/MotionToggle.tsx";
import {
  ThemeToggle,
  themeBootScript,
} from "@/components/landing/ThemeToggle.tsx";
import styles from "@/components/landing/landing.module.css";

const SOURCE_URL = "https://github.com/TheSkinnyRat/tsuki";

async function signInWithDiscord() {
  "use server";
  await signIn("discord", { redirectTo: "/dashboard" });
}

async function signInForDev(formData: FormData) {
  "use server";
  await signIn("dev", {
    discordId: String(formData.get("discordId") ?? ""),
    redirectTo: "/dashboard",
  });
}

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const devLoginEnabled =
    process.env.NODE_ENV !== "production" && Boolean(process.env["DEV_LOGIN"]);

  return (
    <div className={styles.page} data-landing-page="" data-motion-paused="false">
      <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />

      <header className={styles.header}>
        <div className={`${styles.wrap} ${styles.headerRow}`}>
          <a href="#top" className={styles.brand}>
            <span className={styles.mark} />
            <span className={styles.brandName}>tsuki</span>
          </a>
          <nav className={styles.nav}>
            <a className={styles.link} href="#features">Features</a>
            <a className={styles.link} href="#commands">Commands</a>
            <a className={styles.link} href="#run">Run it</a>
            <a className={styles.link} href="#roadmap">Roadmap</a>
            <a className={styles.link} href="#faq">FAQ</a>
          </nav>
          <div className={styles.headerActions}>
            <ThemeToggle />
            <form action={signInWithDiscord}>
              <button type="submit" className={styles.headerCta}>
                Sign in
              </button>
            </form>
          </div>
        </div>
      </header>

      <section id="top" className={`${styles.hero} ${styles.motionSection}`}>
        <Ambient />
        <MotionToggle />
        <div className={`${styles.wrap} ${styles.heroGrid} ${styles.content}`}>
          <div>
            <div className={styles.badge}>
              <span className={styles.dot} />
              In development — bring your own Lavalink node
            </div>
            <h1 className={styles.h1}>
              Music for your server,
              <br />
              run from the browser.
            </h1>
            <p className={styles.lede}>
              Tsuki is a Discord music bot that plays through the Lavalink node
              your server brings. The dashboard mirrors every slash command; the
              sound stays in the voice channel.
            </p>
            <div className={styles.btnRow}>
              <form action={signInWithDiscord}>
                <button type="submit" className={styles.btn}>
                  Sign in with Discord
                </button>
              </form>
              <a href="#how" className={styles.btnGhost}>
                See how it works
              </a>
            </div>
            <p className={styles.heroNote}>
              Open source · no billing · audio stays in Discord
            </p>
          </div>

          <PlayerMock />
        </div>
      </section>

      <section className={styles.stats}>
        <div className={styles.wrap}>
          <div className={styles.statGrid}>
            {STATS.map((stat) => (
              <div key={stat.value} className={styles.stat}>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className={styles.section}>
        <div className={`${styles.wrap} ${styles.pad}`}>
          <div className={styles.eyebrow}>Features</div>
          <h2 className={`${styles.h2} ${styles.h2Gap}`}>
            Everything the queue needs
          </h2>
          <p
            className={styles.sectionLede}
            style={{ maxWidth: 520, marginBottom: 44, lineHeight: 1.5 }}
          >
            Built for servers that would rather own their audio than rent it —
            and where nobody wants to memorise a command list to change the
            song.
          </p>
          <div className={`${styles.cardGrid} ${styles.features}`}>
            {FEATURES.map((feature) => (
              <div key={feature.title} className={styles.feature}>
                <div className={styles.glyph} style={feature.glyph} />
                <h3 className={styles.h3}>{feature.title}</h3>
                <p className={styles.body}>{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.wrap} ${styles.pad}`}>
          <div className={styles.eyebrow}>Setup</div>
          <h2 className={`${styles.h2} ${styles.h2GapLarge}`}>
            Three steps, and the first one is yours
          </h2>
          <div className={styles.steps}>
            {STEPS.map((step, i) => (
              <div key={step.title} className={styles.step}>
                <div className={styles.stepNum}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.body}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="commands" className={styles.section}>
        <div className={`${styles.wrap} ${styles.pad} ${styles.split}`}>
          <div>
            <div className={styles.eyebrow}>Commands</div>
            <h2 className={`${styles.h2} ${styles.h2Gap}`}>
              Still there when you want them
            </h2>
            <p className={styles.sectionLede}>
              Twenty-two slash commands, every one mirrored on the dashboard.
              These are the ones your server will reach for.
            </p>
          </div>
          <div className={styles.table}>
            {COMMANDS.map(([cmd, desc]) => (
              <div key={cmd} className={styles.cmdRow}>
                <code className={styles.cmd}>{cmd}</code>
                <span className={styles.muted}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="run" className={styles.section}>
        <div className={`${styles.wrap} ${styles.pad}`}>
          <div className={styles.runHead}>
            <div>
              <div className={styles.eyebrow}>Run it</div>
              <h2 className={styles.h2}>No plans to pick, just two ways in</h2>
            </div>
          </div>
          <div className={`${styles.cardGrid} ${styles.plans}`}>
            <div className={styles.plan}>
              <div className={styles.planHead}>Bring your own node</div>
              <div className={styles.planFigure}>
                <span className={styles.planBig}>Your node</span>
                <span className={styles.planSmall}>Lavalink v4</span>
              </div>
              <p className={styles.planLede}>
                Use the Tsuki bot and dashboard, and point your server at a
                Lavalink node you run or rent.
              </p>
              <form action={signInWithDiscord} className={styles.planCta}>
                <button
                  type="submit"
                  className={`${styles.btnGhost} ${styles.btnBlock}`}
                >
                  Sign in with Discord
                </button>
              </form>
              <Ticks
                items={[
                  <>
                    Added with <code className={styles.inlineCode}>/node add</code>,
                    password in a private form
                  </>,
                  "Several nodes per server, with failover",
                  "Sources and filters read from the node itself",
                  "Unsupported requests refused with a reason",
                  "Nothing to pay Tsuki",
                ]}
              />
            </div>
            <div className={`${styles.plan} ${styles.planAlt}`}>
              <div className={styles.planHead}>
                <span>Self-host Tsuki</span>
                <span className={styles.tag}>AGPL-3.0</span>
              </div>
              <div className={styles.planFigure}>
                <span className={styles.planBig}>Your bot</span>
                <span className={styles.planSmall}>Node 22+ · pnpm</span>
              </div>
              <p className={styles.planLede}>
                Run the bot, the dashboard and the database yourself, under
                your own Discord application.
              </p>
              <a
                href={SOURCE_URL}
                className={`${styles.btn} ${styles.btnBlock} ${styles.planCta}`}
              >
                Read the source
              </a>
              <Ticks
                items={[
                  "Everything in bring your own node",
                  "Bot, dashboard and schema in one repository",
                  "SQLite or PostgreSQL",
                  "Your own token, your own permissions",
                  "Changes you serve to others stay open",
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      <section id="how" className={styles.section}>
        <div className={`${styles.wrap} ${styles.pad}`}>
          <div className={styles.eyebrow}>How it works</div>
          <div className={`${styles.cardGrid} ${styles.how}`}>
            {HOW.map((card) => (
              <div key={card.caption} className={styles.howCard}>
                <p className={styles.howText}>{card.text}</p>
                <div className={styles.howCaption}>{card.caption}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roadmap" className={styles.section}>
        <div className={`${styles.wrap} ${styles.pad}`}>
          <div className={styles.eyebrow}>Changelog</div>
          <h2 className={`${styles.h2} ${styles.h2GapLarge}`}>
            What works, what&apos;s next
          </h2>
          <div className={styles.roadmap}>
            {ROADMAP.map((column) => (
              <div key={column.title}>
                <div className={styles.roadHead}>
                  <span className={styles.roadDot} style={column.dot} />
                  {column.title}
                </div>
                <div className={styles.roadList}>
                  {column.items.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className={styles.section}>
        <div
          className={`${styles.wrap} ${styles.pad} ${styles.split} ${styles.splitFaq}`}
        >
          <div>
            <div className={styles.eyebrow}>FAQ</div>
            <h2 className={styles.h2}>Common questions</h2>
          </div>
          <Faq items={FAQ} />
        </div>
      </section>

      <section className={`${styles.section} ${styles.motionSection}`}>
        <div className={styles.ambient} aria-hidden="true">
          <span className={styles.ripple} />
          <span className={styles.ripple} />
          <span className={styles.ripple} />
        </div>
        <div className={`${styles.wrap} ${styles.closing} ${styles.content}`}>
          <h2 className={styles.closingTitle}>Point Tsuki at your node</h2>
          <p className={styles.closingLede}>
            Sign in, add a Lavalink node, and the dashboard works from the
            first track.
          </p>
          <div className={`${styles.btnRow} ${styles.center}`}>
            <form action={signInWithDiscord}>
              <button type="submit" className={`${styles.btn} ${styles.btnWide}`}>
                Sign in with Discord
              </button>
            </form>
            <a href={SOURCE_URL} className={`${styles.btnGhost} ${styles.btnWide}`}>
              Read the source
            </a>
          </div>
        </div>
      </section>

      <footer>
        <div className={`${styles.wrap} ${styles.footerRow}`}>
          <div className={styles.footerBrand}>
            <span className={`${styles.mark} ${styles.markSmall}`} />
            <span>© 2026 Tsuki · AGPL-3.0</span>
          </div>
          <div className={styles.footerLinks}>
            <a className={styles.link} href={SOURCE_URL}>Source</a>
            <a className={styles.link} href={`${SOURCE_URL}/blob/main/LICENSE`}>
              Licence
            </a>
            <a className={styles.link} href="#commands">Commands</a>
            <a className={styles.link} href="#faq">FAQ</a>
          </div>
        </div>
        {devLoginEnabled ? (
          <form className={`${styles.wrap} ${styles.devLogin}`} action={signInForDev}>
            <label htmlFor="dev-discord-id">dev login</label>
            <input
              id="dev-discord-id"
              name="discordId"
              placeholder="Discord user id"
              className={styles.devInput}
            />
            <button type="submit" className={styles.devButton}>
              sign in
            </button>
          </form>
        ) : null}
      </footer>
    </div>
  );
}

function Ambient() {
  return (
    <div className={styles.ambient} aria-hidden="true">
      <div className={styles.orbitField}>
        <span className={styles.orbit} />
        <span className={styles.orbit} />
        <span className={styles.orbit} />
      </div>
      {STARS.map(([x, y, cross], i) => (
        <span
          key={i}
          className={cross ? `${styles.star} ${styles.starCross}` : styles.star}
          style={
            {
              "--x": `${x}%`,
              "--y": `${y}%`,
              "--duration": `${6 + (i % 5)}s`,
              "--delay": `${-0.7 * i}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function PlayerMock() {
  return (
    <div className={styles.player} aria-hidden="true">
      <div className={styles.playerBar}>
        <span className={styles.dot} style={{ width: 6, height: 6 }} />
        tsuki dashboard — #lounge
      </div>
      <div className={styles.playerNow}>
        <div className={styles.cover} />
        <div className={styles.nowMeta}>
          <div className={`${styles.trackTitle} ${styles.ellipsis}`}>
            Midnight Commute
          </div>
          <div className={styles.trackArtist}>Sora Kitagawa — Neon Hours</div>
          <div className={styles.progress}>
            <span className={styles.time}>1:42</span>
            <span className={styles.track}>
              <span className={styles.trackFill} />
            </span>
            <span className={styles.time}>3:38</span>
          </div>
        </div>
        <div className={styles.bars}>
          {[0, 0.22, 0.44, 0.66].map((delay) => (
            <span
              key={delay}
              className={styles.bar}
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      </div>
      <div>
        <QueueRow n="02" title="Paper Lanterns" artist="Yuki Mori" time="4:02" />
        <QueueRow n="03" title="Slow Static" artist="Hoshi Club" time="3:11" />
        <div className={styles.queueRow}>
          <span className={styles.queueNum}>04</span>
          <span className={`${styles.ellipsis} ${styles.muted}`} style={{ flex: 1, minWidth: 0 }}>
            Autoplay — picked from this server&apos;s history
          </span>
          <span className={`${styles.time} ${styles.halo}`}>auto</span>
        </div>
      </div>
    </div>
  );
}

function QueueRow(props: { n: string; title: string; artist: string; time: string }) {
  return (
    <div className={styles.queueRow}>
      <span className={styles.queueNum}>{props.n}</span>
      <span className={styles.ellipsis} style={{ flex: 1, minWidth: 0 }}>
        {props.title} <span className={styles.muted}>— {props.artist}</span>
      </span>
      <span className={styles.time}>{props.time}</span>
    </div>
  );
}

function Ticks({ items }: { items: React.ReactNode[] }) {
  return (
    <div className={styles.ticks}>
      {items.map((item, i) => (
        <div key={i} className={styles.tick}>
          <span>—</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

/** [x %, y %, cross-shaped] — the design's star field, in its order. */
const STARS: [number, number, boolean][] = [
  [6, 19, true],
  [19, 9, false],
  [37, 15, false],
  [55, 10, false],
  [69, 13, true],
  [88, 17, false],
  [95, 36, false],
  [91, 72, false],
  [80, 88, true],
  [58, 84, false],
  [33, 91, false],
  [8, 78, false],
  [47, 47, true],
  [64, 64, false],
];

const STATS = [
  { value: "Lavalink v4", label: "the audio node your server brings" },
  { value: "22", label: "slash commands, all on the dashboard" },
  { value: "AGPL-3.0", label: "open source, self-hostable" },
  { value: "0", label: "audio streams through the dashboard" },
];

const FEATURES: { title: string; body: string; glyph: CSSProperties }[] = [
  {
    title: "Control from the web",
    body: "Play, skip, reorder and seek from a browser tab. Slash commands stay available — they just stop being mandatory.",
    glyph: { borderRadius: 7 },
  },
  {
    title: "Bring your own node",
    body: "Each server stores its own Lavalink v4 credentials, can keep several nodes, and fails over between them.",
    glyph: { borderRadius: "50%" },
  },
  {
    title: "Honest capabilities",
    body: "Tsuki reads the node's /v4/info and shows its sources, plugins and filters. A source the node lacks is refused up front, with a reason.",
    glyph: { transform: "rotate(45deg)" },
  },
  {
    title: "Multi-server dashboard",
    body: "One Discord login, every server you share with Tsuki. Pick a server and its queue, playlists and effects are right there.",
    glyph: { borderRadius: "7px 7px 7px 0" },
  },
  {
    title: "Stay in voice & autoplay",
    body: "Keep Tsuki in the channel when it empties, and keep playing from this server's own history when the queue runs dry.",
    glyph: { borderRadius: "50% 7px 50% 7px" },
  },
  {
    title: "Roles & DJ rules",
    body: "Require a DJ role, and decide per channel whether requests are allowed, DJ-only, or locked. One permission check covers both surfaces.",
    glyph: { borderRadius: 3 },
  },
];

const STEPS = [
  {
    title: "Run a Lavalink v4 node",
    body: "On a machine you own or one you rent. Java 17 or newer if you host it yourself.",
  },
  {
    title: "Add it with /node add",
    body: "The password goes into a private form, not the chat. Tsuki reads what the node can play.",
  },
  {
    title: "Start the queue",
    body: "Use /play in Discord or search from the dashboard. Everyone in the channel hears the same queue.",
  },
];

const COMMANDS: [string, string][] = [
  ["/play", "Queue a link or a search term"],
  ["/search", "Search, then pick which result to queue"],
  ["/skip", "Skip the track, or forward to a position"],
  ["/queue", "Show the queue, a page at a time"],
  ["/loop", "Repeat the track, the queue, or nothing"],
  ["/playlist save", "Save what is playing and queued to the server"],
  ["/filter eq", "Equaliser presets, speed, pitch and effects"],
  ["/node add", "Add a Lavalink node through a private form"],
  ["/settings", "DJ role, stay in voice, autoplay, channel rules"],
  ["/lyrics", "Lyrics for what is playing, if the node finds them"],
];

const HOW = [
  {
    text: "You press skip on the dashboard, or type /skip in Discord. Both land on the same service layer inside the bot.",
    caption: "01 — either surface",
  },
  {
    text: "One permission check decides it, and it never asks where the request came from. What a DJ rule forbids in Discord, it forbids on the web.",
    caption: "02 — one rule",
  },
  {
    text: "The bot tells your Lavalink node what to do, and the node sends the sound into the voice channel. The browser never plays a note.",
    caption: "03 — your node",
  },
];

const ROADMAP: { title: string; dot: CSSProperties; items: string[] }[] = [
  {
    title: "Works today",
    dot: { background: "var(--accent)" },
    items: [
      "Playlists and effects on the dashboard",
      "Lyrics, queue paging, name autocomplete",
      "Failover between a server's own nodes",
    ],
  },
  {
    title: "In progress",
    dot: { border: "1px solid var(--halo)" },
    items: [
      "SponsorBlock segments, for nodes with the plugin",
      "A public invite — Tsuki is still in development",
    ],
  },
  {
    title: "Not planned",
    dot: { border: "1px dashed var(--muted)" },
    items: [
      "Audio played through Tsuki's own servers",
      "Paid tiers or premium features",
    ],
  },
];

const FAQ: FaqEntry[] = [
  {
    q: "Do I need the dashboard to use Tsuki?",
    a: "No. Every dashboard action has a slash command behind it, and both call the same code inside the bot. The dashboard is there for people who would rather click than type, and for mods fixing a queue mid-conversation.",
  },
  {
    q: "Does the music play in my browser?",
    a: "No. The dashboard is a remote control. Audio always plays in the Discord voice channel, streamed by your Lavalink node.",
  },
  {
    q: "Which sources can it play from?",
    a: "Whatever your node supports. When a node is saved, Tsuki reads its /v4/info and lists its sources, plugins and filters; a request for a source the node lacks is refused with a reason instead of failing to load.",
  },
  {
    q: "What happens when everyone leaves the channel?",
    a: "Tsuki leaves after a minute alone. Turn on /settings stay and it keeps its seat instead.",
  },
  {
    q: "Can I limit who controls playback?",
    a: "Yes — require a DJ role, and set per-channel rules for requests, DJ-only, or locked. The same check applies whether the request comes from Discord or the dashboard.",
  },
];
