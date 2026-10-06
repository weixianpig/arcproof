export type VerificationStatus = "verified" | "failed" | "unavailable";

export type VerificationCheck = {
  status: VerificationStatus;
  message: string;
};

export type ReceiptVerificationResult = {
  receipt: VerificationCheck;
  file?: VerificationCheck;
  contentCredentials?: VerificationCheck;
  commitment: VerificationCheck;
  anchor: VerificationCheck;
  verified: boolean;
};
