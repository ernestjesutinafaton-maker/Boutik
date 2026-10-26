/**
 * Où envoyer le paiement de l'abonnement (le même numéro que pour ÉcoPay).
 * Bénin seulement pour le moment.
 */
export const SUBSCRIPTION_PAYEE = {
  number: '+229 01 59 38 68 67',
  holder: 'MAHUTIN NOEL AFFATON',
  operatorName: 'MTN Mobile Money',
};

/** Les moyens de paiement du Bénin acceptés pour envoyer la somme. */
export const SUBSCRIPTION_OPERATORS = [
  { code: 'mtn', label: 'MTN MoMo' },
  { code: 'moov', label: 'Moov Money' },
  { code: 'celtiis', label: 'Celtiis Cash' },
  { code: 'other', label: 'Autre' },
] as const;

export type SubscriptionOperator = (typeof SUBSCRIPTION_OPERATORS)[number]['code'];
