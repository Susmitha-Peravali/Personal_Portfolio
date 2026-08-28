import { profile } from "@/lib/data/profile";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { ContactForm } from "./ContactForm";
import { Button } from "@/components/ui/Button";
import { Github, Linkedin, Download } from "lucide-react";
import { WireframeShape } from "@/components/decor/WireframeShape";

export function ContactSection() {
  return (
    <section id="contact" className="py-28 md:py-36 relative">
      <WireframeShape
        shape="tetrahedron"
        size={150}
        className="hidden lg:block absolute bottom-6 left-4 opacity-25"
      />

      <div className="container-page grid md:grid-cols-2 gap-16 items-start">
        <RevealOnScroll>
          <SectionEyebrow>Contact</SectionEyebrow>
          <h2 className="font-display text-3xl sm:text-4xl leading-tight mb-6">
            Building something worth talking about?
          </h2>
          <p className="text-ink-secondary leading-relaxed max-w-md mb-8">
            I&apos;m open to full-stack, backend, and AI-focused roles, and to conversations about
            interesting problems in general.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href={profile.resumeUrl} variant="ghost" icon={Download} external>
              Resume
            </Button>
            <Button href={profile.github} variant="ghost" icon={Github} external>
              GitHub
            </Button>
            <Button href={profile.linkedin} variant="ghost" icon={Linkedin} external>
              LinkedIn
            </Button>
          </div>
        </RevealOnScroll>

        <RevealOnScroll index={1}>
          <ContactForm />
        </RevealOnScroll>
      </div>
    </section>
  );
}
