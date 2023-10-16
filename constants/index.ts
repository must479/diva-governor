export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
export const ONE_YEAR_SECONDS = 31536000;

export enum DelayType {
  DEFAULT,
  SHORT,
  LONG,
}

export enum ThresholdType {
  DEFAULT,
  MODERATE,
  LARGE,
}

export enum ProposalState {
  Pending,
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed,
}
