// Built-in occupation catalogue — broad enough to cover any owner, so nobody
// has to curate the list. Only each occupation's Company Type is configured.
// Grouped for readability in the settings page; the group is not stored.

export const OCCUPATION_GROUPS: { group: string; names: string[] }[] = [
  {
    group: "Employment status",
    names: [
      "Company Employee",
      "Government Officer",
      "State Enterprise Employee",
      "Business Owner / Merchant",
      "Self-Employed",
      "Freelancer",
      "Student",
      "Housewife / Househusband",
      "Retired",
      "Unemployed",
    ],
  },
  {
    group: "Agriculture & fishing",
    names: ["Farmer", "Livestock Farmer", "Fisherman", "Forestry Worker", "Agricultural Trader"],
  },
  {
    group: "Food & beverage",
    names: ["Restaurant Owner", "Chef / Cook", "Barista", "Street Food Vendor", "Bartender", "Food Delivery Rider"],
  },
  {
    group: "Retail & trade",
    names: ["Shop Owner", "Sales Assistant", "Market Trader", "Online Seller / E-commerce", "Wholesaler", "Cashier"],
  },
  {
    group: "Transport & logistics",
    names: [
      "Taxi / Ride-hailing Driver",
      "Truck Driver",
      "Courier / Delivery Driver",
      "Logistics Staff",
      "Warehouse Worker",
      "Pilot / Cabin Crew",
      "Seafarer",
    ],
  },
  {
    group: "Construction & trades",
    names: [
      "Construction Worker",
      "Contractor / Builder",
      "Electrician",
      "Plumber",
      "Carpenter",
      "Welder",
      "Painter / Decorator",
      "Architect",
      "Civil Engineer",
      "Surveyor",
    ],
  },
  {
    group: "Manufacturing",
    names: ["Factory Worker", "Machine Operator", "Production Supervisor", "Quality Inspector", "Technician"],
  },
  {
    group: "Technology",
    names: [
      "Software Developer",
      "IT Support",
      "Network / System Engineer",
      "Data Analyst",
      "UI / UX Designer",
      "Cybersecurity Specialist",
      "Game Developer",
    ],
  },
  {
    group: "Finance & insurance",
    names: [
      "Accountant",
      "Bookkeeper",
      "Auditor",
      "Bank Staff",
      "Financial Advisor",
      "Insurance Agent",
      "Trader / Investor",
    ],
  },
  {
    group: "Healthcare",
    names: [
      "Doctor",
      "Nurse",
      "Pharmacist",
      "Dentist",
      "Veterinarian",
      "Medical Technician",
      "Physiotherapist",
      "Caregiver",
    ],
  },
  {
    group: "Education",
    names: ["Teacher", "University Lecturer", "Tutor", "Childcare Worker", "School Administrator"],
  },
  {
    group: "Legal & public service",
    names: ["Lawyer", "Notary", "Police Officer", "Military Personnel", "Firefighter", "Civil Servant", "Judge"],
  },
  {
    group: "Media & creative",
    names: [
      "Journalist",
      "Photographer",
      "Videographer",
      "Graphic Designer",
      "Musician",
      "Content Creator / Influencer",
      "Actor / Performer",
      "Writer / Editor",
    ],
  },
  {
    group: "Hospitality & tourism",
    names: ["Hotel Staff", "Tour Guide", "Travel Agent", "Event Organiser", "Housekeeping Staff"],
  },
  {
    group: "Beauty & wellness",
    names: ["Hairdresser / Barber", "Beautician", "Massage Therapist", "Fitness Trainer", "Nail Technician"],
  },
  {
    group: "Property",
    names: ["Real Estate Agent", "Property Manager", "Landlord"],
  },
  {
    group: "Professional services",
    names: [
      "Consultant",
      "Marketing Specialist",
      "HR Specialist",
      "Administrative Staff",
      "Customer Service",
      "Translator / Interpreter",
      "Procurement Officer",
    ],
  },
  {
    group: "Security & facilities",
    names: ["Security Guard", "Cleaner", "Maintenance Worker", "Gardener"],
  },
  {
    group: "Other",
    names: ["Researcher / Scientist", "NGO / Charity Worker", "Religious Worker", "Other"],
  },
];

export const OCCUPATION_NAMES: string[] = OCCUPATION_GROUPS.flatMap((g) => g.names);

/** Group label for an occupation name (falls back to "Other"). */
export function groupOf(name: string): string {
  return OCCUPATION_GROUPS.find((g) => g.names.includes(name))?.group ?? "Other";
}
