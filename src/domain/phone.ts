/**
 * Numéros de téléphone : on les enregistre au format international
 * (« +2290197000000 »), indispensable pour WhatsApp.
 */

/**
 * Transforme un numéro tapé en format international.
 *   « 01 97 00 00 00 » au Bénin (+229) → « +2290197000000 »
 *   « 00229 01 97 00 00 00 » ou « +229 01 97… » → pareil
 * Le 0 du début est gardé : au Bénin et en Côte d'Ivoire, il fait partie du numéro.
 * Renvoie null si ce n'est pas un numéro plausible.
 */
export function normalizePhone(input: string, dialCode: string): string | null {
  let text = input.replace(/[\s.\-()/]/g, '');
  if (text.startsWith('00')) {
    text = `+${text.slice(2)}`;
  }
  if (!text.startsWith('+')) {
    text = `${dialCode}${text}`;
  }
  return /^\+\d{8,15}$/.test(text) ? text : null;
}

/**
 * Un numéro international, lisible : « +2290197000001 » → « +229 01 97 00 00 01 »
 * (indicatif du pays à 3 chiffres, puis groupes de 2 : Bénin, Côte d'Ivoire, Togo, Burkina,
 * Mali, Niger). Les autres formats (nombre impair de chiffres…) sont rendus tels quels.
 */
export function formatPhone(phone: string): string {
  const match = /^\+(2\d{2})(\d{6,12})$/.exec(phone);
  if (!match) {
    return phone;
  }
  const [, country, rest] = match;
  if (rest.length % 2 !== 0) {
    return phone;
  }
  return `+${country} ${(rest.match(/\d{1,2}/g) ?? []).join(' ')}`;
}

/** Lien qui ouvre WhatsApp sur la conversation du client, avec un message prêt à envoyer. */
export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
