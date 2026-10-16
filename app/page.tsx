import type { Metadata } from "next";
import { Hero } from "@/components/features/home/Hero";
import UpcomingEventCard from "@/components/features/home/UpcomingEventCard";
import { TrustedBy } from "@/components/features/home/TrustedBy";
import { ScrollRevealSection } from "@/components/features/home/ScrollRevealSection";
import { WhyCloudMatters } from "@/components/features/home/WhyCloudMatters";
import { WhatYouCanBuild } from "@/components/features/home/WhatYouCanBuild";
import { OurMission } from "@/components/features/home/OurMission";
import { WhyJoin } from "@/components/features/home/WhyJoin";
import { TeamDepartments } from "@/components/features/team/TeamDepartments";
import { FeaturedEvents } from "@/components/features/home/FeaturedEvents";
import { LearningHubPreview } from "@/components/features/home/LearningHubPreview";
import { CommunityHighlights } from "@/components/features/home/CommunityHighlights";
import { JoinCTA } from "@/components/features/home/JoinCTA";

export const metadata: Metadata = {
  title:
    "AWS Student Builder Group at Tulas University | Official AWS Cloud Community",
  description:
    "Official website of AWS Student Builder Group at Tulas University, Dehradun. Join workshops, cloud events, hackathons, AWS learning programs, and student innovation initiatives powered by AWS.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <>
      <Hero />
      <UpcomingEventCard />
      <ScrollRevealSection />
      {/* <WhyCloudMatters /> */}
      <TrustedBy />
      <WhatYouCanBuild />
      <TeamDepartments />
      <OurMission />
      <WhyJoin />
      <FeaturedEvents />
      <LearningHubPreview />
      {/* <CommunityHighlights /> */}
      <JoinCTA />
    </>
  );
}