import { profile } from "@/lib/data/profile";
import { Github, Linkedin, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-line mt-32">
      <div className="container-page py-14 flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="font-display text-lg text-ink-secondary italic text-center md:text-left">
          &ldquo;Building ideas into impactful software.&rdquo;
        </p>
        <div className="flex items-center gap-5">
          <a
            href={profile.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="text-ink-secondary hover:text-accent-primary transition-colors"
          >
            <Github size={18} />
          </a>
          <a
            href={profile.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="text-ink-secondary hover:text-accent-primary transition-colors"
          >
            <Linkedin size={18} />
          </a>
          <a
            href={`mailto:${profile.email}`}
            aria-label="Email"
            className="text-ink-secondary hover:text-accent-primary transition-colors"
          >
            <Mail size={18} />
          </a>
        </div>
        <p className="text-xs text-ink-muted font-mono">
          © {new Date().getFullYear()} {profile.name}
        </p>
      </div>
    </footer>
  );
}
