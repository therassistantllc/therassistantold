import { CodingForm } from "./coder-engine";

export function generateSOAP(form: CodingForm, codes: string[]) {
  const subjective = `
Client participated in a session.
Primary concerns relate to ${form.diagnosisCode || form.diagnosisCategory || "presenting symptoms"}.
Client engagement and response to interventions were observed.
`;

  const objective = `
Session duration: ${form.mins || "N/A"} minutes.
Interventions applied: ${form.interventions.join(", ") || "none documented"}.
Screening tools: ${form.screenTools.join(", ") || "none"}.
`;

  const assessment = `
Clinical presentation supports diagnosis of ${form.diagnosisCode || form.diagnosisCategory || "unspecified"}.
Coding considerations include: ${codes.join(", ") || "none"}.
Risk level: ${form.mh_risk ? "elevated factors present" : "no acute risk indicated"}.
`;

  const plan = `
Continue treatment as clinically indicated.
Reinforce interventions and monitor progress toward goals.
${form.plan_goals ? "Treatment goals reviewed or updated." : ""}
${form.planFreqChange ? "Service frequency adjusted." : ""}
`;

  return {
    subjective,
    objective,
    assessment,
    plan,
    full: `
SUBJECTIVE:
${subjective}

OBJECTIVE:
${objective}

ASSESSMENT:
${assessment}

PLAN:
${plan}
    `
  };
}