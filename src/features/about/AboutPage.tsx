/** About / Challenge page. */
import { Page } from "@/components/ui";
import { MeraCharacter } from "@/components/MeraCharacter";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-micro font-semibold tracking-[0.14em] text-muted uppercase">{title}</h2>
      <div className="mt-2 space-y-3 text-body text-ink">{children}</div>
    </section>
  );
}

export function AboutPage() {
  return (
    <Page eyebrow="Meep Emotional Reset Assistant" title="MERA" intro="Come back to yourself. Your Meep for the moments that feel like too much.">
      <MeraCharacter state="resting" size={96} />
      <p className="mt-6 text-small text-ink-2">Built for Hacktoberfest 2026 — Touch Grass. By Cass - NextRealm Interactive.</p>

      <Block title="The problem">
        <p>Many digital wellness tools still ask you to spend more time looking at your phone.</p>
      </Block>
      <Block title="The idea">
        <p>MERA does the opposite. It helps you ground yourself quickly, gives you one real-world thing to do, then asks you to put the phone away.</p>
        <p className="font-display text-h3">MERA uses AI to shorten the digital experience, not extend it.</p>
      </Block>
      <Block title="Why Gemma">
        <p>
          Gemma is MERA’s open-weight intelligence layer. It picks one real-world mission from how you feel and what has helped before, and writes a sentence or
          two after a reset — always validated, always optional, with a built-in library when it’s unavailable.
        </p>
      </Block>
      <Block title="Why Render">
        <p>Render hosts MERA’s production app and its small server: the installable web app, a health check, and the optional Connected AI endpoint.</p>
      </Block>
      <Block title="Why open matters">
        <p>
          Some of the most personal things people write should not require sending those thoughts to a remote proprietary AI provider. Open weights let Gemma
          run right here in your browser, offline, with your notes staying on the device (Connected AI is a separate, opt-in choice) — and let anyone inspect,
          swap or tune the model.
        </p>
      </Block>
      <Block title="What MERA is not">
        <p>
          MERA is a grounding and wellness tool. It isn’t therapy, a diagnosis, a treatment, or a crisis service, and it doesn’t replace professional care. If
          you’re in danger or thinking about harming yourself, contact local emergency services or a crisis line where you live.
        </p>
      </Block>
    </Page>
  );
}
