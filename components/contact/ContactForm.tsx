"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { profile } from "@/lib/data/profile";
import { GlassPanel } from "@/components/ui/GlassPanel";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`Portfolio inquiry from ${name || "a visitor"}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
  }

  return (
    <GlassPanel className="p-7 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-5" aria-label="Contact form">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Name" id="name" value={name} onChange={setName} required />
          <Field label="Email" id="email" type="email" value={email} onChange={setEmail} required />
        </div>
        <div>
          <label htmlFor="message" className="block text-xs font-mono uppercase tracking-wide text-ink-secondary mb-2">
            Message
          </label>
          <textarea
            id="message"
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-2xl bg-white/[0.04] border border-line px-4 py-3 text-ink-primary placeholder:text-ink-muted focus-visible:border-accent-primary transition-colors resize-none"
            placeholder="What are you building, or what would you like to ask?"
          />
        </div>
        <button
          type="submit"
          className="btn-tactile inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium bg-accent-gradient text-bg-primary hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-accent-primary"
        >
          Send message
          <Send size={16} />
        </button>
      </form>
    </GlassPanel>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-mono uppercase tracking-wide text-ink-secondary mb-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl bg-white/[0.04] border border-line px-4 py-3 text-ink-primary placeholder:text-ink-muted focus-visible:border-accent-primary transition-colors"
      />
    </div>
  );
}
