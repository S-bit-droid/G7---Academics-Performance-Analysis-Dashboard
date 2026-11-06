export type ProvisionState = {
  message: string;
  results: { line: number; email: string; outcome: string }[];
};

export const emptyProvisionState: ProvisionState = { message: "", results: [] };

export type HodAppointmentState = { message: string; ok: boolean };
export const emptyHodAppointmentState: HodAppointmentState = { message: "", ok: false };
