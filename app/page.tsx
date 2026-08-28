import { IntroSequence } from "@/components/intro/IntroSequence";
import { SmoothScrollProvider } from "@/components/layout/SmoothScrollProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/hero/Hero";
import { About } from "@/components/about/About";
import { SkillsSection } from "@/components/skills/SkillsSection";
import { ExperienceTimeline } from "@/components/experience/ExperienceTimeline";
import { ProjectsSection } from "@/components/projects/ProjectsSection";
import { AchievementsSection } from "@/components/achievements/AchievementsSection";
import { EducationStrip } from "@/components/education/EducationStrip";
import { ContactSection } from "@/components/contact/ContactSection";

export default function Home() {
  return (
    <IntroSequence>
      <SmoothScrollProvider>
        <Navbar />
        <main>
          <Hero />
          <About />
          <SkillsSection />
          <ExperienceTimeline />
          <ProjectsSection />
          <AchievementsSection />
          <EducationStrip />
          <ContactSection />
        </main>
        <Footer />
      </SmoothScrollProvider>
    </IntroSequence>
  );
}
