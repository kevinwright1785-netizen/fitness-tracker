export type Gender = "male" | "female" | "other";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "very";

export type GoalType = "maintain" | "lose";

export function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function calculateTDEE(params: {
  gender: Gender;
  weightLbs: number;
  heightCm: number;
  age: number;
  activity: ActivityLevel;
  goal: GoalType;
  weeklyPaceLbs?: number | null;
}): number {
  const { gender, weightLbs, heightCm, age, activity, goal, weeklyPaceLbs } =
    params;

  const weightKg = weightLbs * 0.45359237;
  const height = heightCm;

  const maleBmr = 10 * weightKg + 6.25 * height - 5 * age + 5;
  const femaleBmr = 10 * weightKg + 6.25 * height - 5 * age - 161;

  let bmr: number;
  if (gender === "male") bmr = maleBmr;
  else if (gender === "female") bmr = femaleBmr;
  else bmr = (maleBmr + femaleBmr) / 2;

  const activityMultiplier: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very: 1.725
  };

  let tdee = bmr * activityMultiplier[activity];

  if (goal === "lose" && weeklyPaceLbs && weeklyPaceLbs > 0) {
    tdee -= weeklyPaceLbs * 500;
  }

  return Math.round(tdee);
}

export function calculateMacros(
  calories: number,
  goal: GoalType
): {
  protein: number;
  carbs: number;
  fat: number;
} {
  let proteinPct: number;
  let carbsPct: number;
  let fatPct: number;

  if (goal === "lose") {
    proteinPct = 0.35;
    carbsPct = 0.35;
    fatPct = 0.3;
  } else {
    proteinPct = 0.3;
    carbsPct = 0.45;
    fatPct = 0.25;
  }

  const protein = Math.round((calories * proteinPct) / 4);
  const carbs = Math.round((calories * carbsPct) / 4);
  const fat = Math.round((calories * fatPct) / 9);

  return { protein, carbs, fat };
}

