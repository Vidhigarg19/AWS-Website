export interface LeadershipMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  bio?: string;
  socials: {
    github?: string;
    linkedin?: string;
    email?: string;
  };
}

export const LEADERSHIP_TEAM: LeadershipMember[] = [
  {
    id: "faculty-coordinator",
    name: "Abhishek Rawat",
    role: "Faculty Coordinator",
    avatar: "/members/boy2.png",
    bio: "Providing institutional direction, academic governance, and strategic mentorship to empower student builders in cloud innovation.",
    socials: {
      linkedin: "#",
      email: "#"
    }
  },
  {
    id: "piyush-lingwal",
    name: "Piyush Lingwal",
    role: "Builder Group Leader",
    avatar: "/members/piyushlingwal.png",
    bio: "Leading community vision, technical bootcamps, and open-source cloud initiatives across all student builder wings.",
    socials: {
      github: "https://github.com/piyush-lingwal/",
      linkedin: "https://www.linkedin.com/in/piyush-lingwal-5a8874382/",
      email: "piyush.202304205@tulas.edu.in"
    }
  }
];
