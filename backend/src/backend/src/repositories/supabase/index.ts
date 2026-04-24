import { createSupabaseServiceClient } from "./client";
import { createSupabaseAlertRepository } from "./alert-repository";
import { createSupabaseClaimRepository } from "./claim-repository";
import { createSupabaseClientRepository } from "./client-repository";
import { createSupabaseEncounterRepository } from "./encounter-repository";
import { createSupabaseInsuranceRepository } from "./insurance-repository";
import { createSupabasePaymentRepository } from "./payment-repository";
import { createSupabaseScheduleRepository } from "./schedule-repository";
import { createSupabaseTicketRepository } from "./ticket-repository";
import { createSupabaseWorkqueueRepository } from "./workqueue-repository";

export function createSupabaseRepositories() {
  const db = createSupabaseServiceClient();

  return {
    scheduleRepository: createSupabaseScheduleRepository(db),
    encounterRepository: createSupabaseEncounterRepository(db),
    clientRepository: createSupabaseClientRepository(db),
    insuranceRepository: createSupabaseInsuranceRepository(db),
    claimRepository: createSupabaseClaimRepository(db),
    workqueueRepository: createSupabaseWorkqueueRepository(db),
    alertRepository: createSupabaseAlertRepository(db),
    ticketRepository: createSupabaseTicketRepository(db),
    paymentRepository: createSupabasePaymentRepository(db),
  };
}
