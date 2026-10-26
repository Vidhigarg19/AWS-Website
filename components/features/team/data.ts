export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
  handle?: string;
  status?: string;
  bio?: string;
  quote?: string;
  specializations: string[];
  responsibilities?: string[];
  socials: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    email?: string;
    portfolio?: string;
  };
}

export interface LeadershipMember extends TeamMember {
  titleBadge: string;
  highlightQuote: string;
  impactMetric: string;
}

export const LEADERSHIP_TEAM: LeadershipMember[] = [
  {
    id: "faculty-coordinator",
    name: "Abhishek Rawat",
    role: "Faculty Coordinator",
    department: "Advisory & Governance",
    avatar: "/members/boy2.png",
    titleBadge: "Faculty Coordinator",
    bio: "Providing institutional direction, academic governance, and strategic mentorship to empower student builders in cloud innovation.",
    highlightQuote: "Technology grows best when students build together with vision, grit, and hands-on experimentation.",
    impactMetric: "Guiding 300+ Student Builders",
    specializations: ["Cloud Architecture", "Distributed Systems", "Academic Mentorship", "AI Research"],
    responsibilities: [
      "Institutional direction & community governance",
      "AWS Academy & University alignment",
      "Strategic industry collaborations",
      "Research & innovation guidance"
    ],
    socials: {
      linkedin: "#",
      email: "#"
    }
  },
  {
    id: "piyush-lingwal",
    name: "Piyush Lingwal",
    role: "Builder Group Leader",
    department: "Engineering & AI",
    avatar: "/members/piyushlingwal.png",
    handle: "piyush-lingwal",
    status: "Building AI",
    titleBadge: "Builder Group Leader",
    bio: "Leading community vision, technical bootcamps, and open-source cloud initiatives across all student builder wings.",
    highlightQuote: "Fostering technical depth, open-source building, and peer-to-peer cloud education.",
    impactMetric: "40+ Events & Workshops",
    specializations: ["Full Stack Development", "Generative AI", "AWS Serverless", "Docker"],
    responsibilities: [
      "Leading technical curriculum & bootcamps",
      "Mentoring student dev teams",
      "Supervising AWS certification paths",
      "Managing open-source contributions"
    ],
    socials: {
      github: "https://github.com/piyush-lingwal/",
      linkedin: "https://www.linkedin.com/in/piyush-lingwal-5a8874382/",
      email: "piyush.202304205@tulas.edu.in"
    }
  }
];
