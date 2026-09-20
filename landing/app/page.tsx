import Image from 'next/image';
import { HeroVideo } from './components/HeroVideo';
import { MotionField } from './components/MotionField';
import { RiveActivity } from './components/RiveActivity';
import klipPet from '../public/klip-pet.png';

const REPO = 'https://github.com/root-daemon/klip';
const RELEASES = `${REPO}/releases/latest`;

const PROVIDERS = ['Anthropic Claude', 'OpenAI', 'Google Gemini', 'Ollama'];

export default function Page() {
  return (
    <main>
      <MotionField />
      <nav className="nav" aria-label="Main navigation">
        <a className="nav-brand" href="#top" aria-label="KLIP home">
          <Image src={klipPet} alt="" />
          <span>KLIP</span>
        </a>
        <div className="nav-links">
          <a href="#capabilities">Capabilities</a>
          <a href="#how-it-works">How it works</a>
          <a href="#safety">Safety</a>
          <a href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        <a className="button button-small" href={RELEASES} target="_blank" rel="noopener noreferrer">
          Download
        </a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker">A screen-aware desktop companion</p>
          <h1>Speak.<br />Get it done.</h1>
          <p className="hero-text">
            KLIP listens, sees what is on screen, and can carefully operate your computer when you ask it to.
          </p>
          <div className="hero-actions">
            <a className="button" href={RELEASES} target="_blank" rel="noopener noreferrer">Download KLIP</a>
            <a className="text-link" href="#capabilities">Explore capabilities</a>
          </div>
        </div>
        <div className="hero-companion" aria-label="KLIP companion">
          <div className="hero-rive-wrap" aria-hidden="true"><RiveActivity className="hero-rive" /></div>
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <Image src={klipPet} alt="KLIP companion with glowing red eyes" priority />
          <p>Present when needed. Quiet when not.</p>
        </div>
      </section>

      <section className="intro" aria-label="KLIP overview">
        <p className="kicker">More than chat</p>
        <h2>A companion with a body, not another browser tab.</h2>
        <p>
          Hold your shortcut, ask in your own words, and KLIP routes the request to the right kind of help. A conversation stays lightweight. A desktop task gets fresh visual context before every action.
        </p>
      </section>

      <section className="state-section" id="state" aria-labelledby="state-heading">
        <div className="state-copy">
          <p className="kicker">Presence, not noise</p>
          <h2 id="state-heading">KLIP makes its place in the loop obvious.</h2>
          <p>
            The companion is a practical status surface. You can tell whether KLIP is listening, working, waiting for you, or done without having to hunt through a chat transcript.
          </p>
          <div className="state-legend" aria-label="KLIP companion states">
            <span><i className="state-listening" />Listening</span>
            <span><i className="state-thinking" />Thinking</span>
            <span><i className="state-finished" />Finished</span>
          </div>
        </div>
        <div className="live-state spotlight-surface" data-spotlight="true" aria-label="Animated example of KLIP processing state">
          <div className="live-state-bar"><span>KLIP / CURRENT STATE</span><b>PROCESSING</b></div>
          <div className="rive-stage"><RiveActivity /></div>
          <p><i />Watching for a fresh screen</p>
        </div>
      </section>

      <section className="command-deck" aria-labelledby="command-heading">
        <div className="command-copy">
          <p className="kicker">A visible operating loop</p>
          <h2 id="command-heading">See intent become progress.</h2>
          <p>
            KLIP keeps the work legible while it is happening. The companion, action loop, and next decision stay in view instead of disappearing behind a loading state.
          </p>
          <div className="command-chips" aria-label="Example operating states">
            <span><i />Fresh context</span>
            <span><i />One next action</span>
            <span><i />Verification</span>
          </div>
        </div>
        <div className="command-console spotlight-surface" data-spotlight="true" aria-label="Animated KLIP operating console">
          <div className="console-topline"><span>KLIP / ACTIVE LOOP</span><b>LIVE</b></div>
          <div className="console-scene">
            <span className="console-ring ring-a" />
            <span className="console-ring ring-b" />
            <RiveActivity className="console-rive" />
            <Image className="console-pet" src={klipPet} alt="" />
            <span className="console-ping ping-a" />
            <span className="console-ping ping-b" />
          </div>
          <div className="console-log" aria-hidden="true">
            <p><b>01</b><span>screen context received</span><i>ready</i></p>
            <p><b>02</b><span>selecting one next move</span><i>active</i></p>
            <p><b>03</b><span>waiting to verify outcome</span><i>queued</i></p>
          </div>
        </div>
      </section>

      <section className="demo-section" id="capabilities">
        <div className="section-heading">
          <p className="kicker">Observe, decide, act</p>
          <h2>Every desktop action is a careful loop.</h2>
        </div>
        <HeroVideo />
        <div className="loop-grid">
          <article><span>01</span><h3>Observe</h3><p>KLIP captures the current screen and adds a coordinate grid for precise context.</p></article>
          <article><span>02</span><h3>Decide</h3><p>Your selected reasoning provider chooses one next action, not a blind click sequence.</p></article>
          <article><span>03</span><h3>Verify</h3><p>A fresh screenshot follows each action so KLIP can confirm what actually changed.</p></article>
        </div>
      </section>

      <section className="routing-section" id="how-it-works" aria-labelledby="routing-heading">
        <div className="section-heading routing-heading">
          <p className="kicker">Request routing</p>
          <h2 id="routing-heading">One ask. The right kind of help.</h2>
        </div>
        <div className="routing-map spotlight-surface" data-spotlight="true">
          <div className="route-source">
            <span>INPUT</span>
            <strong>Your words</strong>
            <p>Voice or text enters once.</p>
          </div>
          <div className="route-branch" aria-hidden="true">
            <RiveActivity
              className="route-rive"
              src="/klip-routing.riv"
              stateMachines="State Machine 1"
            />
          </div>
          <div className="route-destinations">
            <article>
              <span>01 / CONVERSATION</span>
              <h3>Answer, plan, or create.</h3>
              <p>For knowledge work, KLIP stays light and returns a useful response or file.</p>
            </article>
            <article>
              <span>02 / DESKTOP TASK</span>
              <h3>Observe before action.</h3>
              <p>For computer work, KLIP takes fresh visual context, picks one next step, then checks what changed.</p>
            </article>
          </div>
          <div className="route-outcome">
            <span>OUTCOME</span>
            <strong>A response<br />or a result.</strong>
          </div>
        </div>
      </section>

      <section className="capability-grid">
        <article className="capability capability-wide spotlight-surface" data-spotlight="true">
          <p className="kicker">Voice and conversation</p>
          <h2>Hold a shortcut. Start talking.</h2>
          <p>Use push-to-talk or toggle mode. KLIP transcribes through Groq, OpenAI, Sarvam, or available native speech services, then can answer aloud with ElevenLabs or Sarvam.</p>
          <div className="voice-rive-wrap" aria-hidden="true"><RiveActivity className="voice-rive" /></div>
        </article>
        <article className="capability capability-pet spotlight-surface" data-spotlight="true">
          <Image src={klipPet} alt="" />
          <p>The companion is also the status indicator. Its gaze and motion make listening, thinking, success, and failure legible at a glance.</p>
        </article>
        <article className="capability spotlight-surface" data-spotlight="true">
          <p className="kicker">Workforce</p>
          <h2>A named crew for wider tasks.</h2>
          <p>When work spans applications, KLIP coordinates named workers. Input stays serialized because there is one real mouse.</p>
        </article>
        <article className="capability spotlight-surface" data-spotlight="true">
          <p className="kicker">Memory</p>
          <h2>Context that stays bounded.</h2>
          <p>Older turns compact into a visible rolling summary so long sessions remain useful without a silent context cliff.</p>
        </article>
        <article className="capability capability-docs spotlight-surface" data-spotlight="true">
          <p className="kicker">Documents</p>
          <h2>Ask for a file. Get a real file.</h2>
          <p>KLIP can generate Excel workbooks, PDFs, CSV files, and text documents directly into your Documents folder.</p>
          <div className="file-row"><b>.xlsx</b><b>.pdf</b><b>.csv</b><b>.txt</b></div>
        </article>
      </section>

      <section className="provider-section">
        <div>
          <p className="kicker">Choose your reasoning</p>
          <h2>One interface. Your preferred model.</h2>
          <p>Switch between cloud and local models without changing how you work. API keys remain in your operating system's encrypted secret store.</p>
        </div>
        <div className="providers" aria-label="Supported reasoning providers">
          {PROVIDERS.map((provider) => <span className="spotlight-surface" data-spotlight="true" key={provider}>{provider}</span>)}
        </div>
      </section>

      <section className="desktop-section" aria-labelledby="desktop-heading">
        <div className="desktop-copy">
          <p className="kicker">A desktop-native point of view</p>
          <h2 id="desktop-heading">Keep your tools. Change the friction.</h2>
          <p>KLIP sits beside the apps, folders, models, and file formats you already rely on. It is designed to help across them, not pull the work into another closed workspace.</p>
        </div>
        <div className="desktop-details">
          <article><span>01</span><h3>Files stay files</h3><p>Generate a spreadsheet, PDF, CSV, or text document where you expect to find it.</p></article>
          <article><span>02</span><h3>Models stay yours</h3><p>Use preferred cloud providers, bring an API key, or choose a local model through Ollama.</p></article>
          <article><span>03</span><h3>Control stays visible</h3><p>Use the tray companion, speak when it helps, and keep meaningful actions subject to consent.</p></article>
        </div>
      </section>

      <section className="safety" id="safety">
        <div className="safety-mark">SAFE BY<br />DESIGN</div>
        <div>
          <p className="kicker">Safety governor</p>
          <h2>Control with clear limits.</h2>
          <p>Auto-type, auto-click, and analytics are opt-in. KLIP stops before deletes, payments, messages, public posts, or terms unless you asked for that exact outcome.</p>
          <ul>
            <li>25-step and 3-minute task limits</li>
            <li>Fresh observation instead of guessing</li>
            <li>On-screen text treated as untrusted data</li>
            <li>Passwords, payment cards, and codes are off limits</li>
          </ul>
        </div>
      </section>

      <section className="closing">
        <Image src={klipPet} alt="" />
        <p className="kicker">Windows, macOS, and Linux</p>
        <h2>A more present way to use AI on your desktop.</h2>
        <a className="button" href={RELEASES} target="_blank" rel="noopener noreferrer">Download KLIP</a>
      </section>

      <footer>
        <a className="nav-brand" href="#top"><Image src={klipPet} alt="" /><span>KLIP</span></a>
        <p>Built as an independent, cross-platform desktop companion.</p>
        <a href={REPO} target="_blank" rel="noopener noreferrer">View source on GitHub</a>
      </footer>
    </main>
  );
}
