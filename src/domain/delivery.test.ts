import { describe, expect, it } from 'vitest';

import {
  collectionError,
  courierActions,
  courierBalances,
  deliveryGroup,
  isDeliveryStatus,
  isFinalStatus,
  parseTime,
  receiptPath,
  requestedMoment,
  suggestedCollection,
} from './delivery';

describe('Livraisons', () => {
  it('les états : à faire, en cours, terminées', () => {
    expect(deliveryGroup('pending')).toBe('todo');
    expect(deliveryGroup('failed')).toBe('todo');
    expect(deliveryGroup('in_progress')).toBe('active');
    expect(deliveryGroup('delivered')).toBe('done');
    expect(deliveryGroup('cancelled')).toBe('done');
    expect(isFinalStatus('delivered')).toBe(true);
    expect(isFinalStatus('failed')).toBe(false);
    expect(isDeliveryStatus('in_progress')).toBe(true);
    expect(isDeliveryStatus('perdue')).toBe(false);
  });

  it('le livreur prend une livraison ouverte ou la sienne, jamais celle d’un autre', () => {
    expect(courierActions({ status: 'pending', assignedTo: null }, 'koffi')).toEqual(['take']);
    expect(courierActions({ status: 'pending', assignedTo: 'koffi' }, 'koffi')).toEqual(['take']);
    expect(courierActions({ status: 'pending', assignedTo: 'codjo' }, 'koffi')).toEqual([]);
    expect(courierActions({ status: 'in_progress', assignedTo: 'koffi' }, 'koffi')).toEqual([
      'complete',
      'fail',
      'release',
    ]);
    expect(courierActions({ status: 'in_progress', assignedTo: 'codjo' }, 'koffi')).toEqual([]);
    expect(courierActions({ status: 'failed', assignedTo: 'koffi' }, 'koffi')).toEqual(['take']);
    expect(courierActions({ status: 'delivered', assignedTo: 'koffi' }, 'koffi')).toEqual([]);
    expect(courierActions({ status: 'cancelled', assignedTo: null }, 'koffi')).toEqual([]);
  });

  it('encaisser : le montant prévu, sans dépasser ce que doit le client', () => {
    expect(suggestedCollection(15000, 20000)).toBe(15000);
    expect(suggestedCollection(15000, 9000)).toBe(9000);
    expect(suggestedCollection(15000, 0)).toBe(0);
    expect(suggestedCollection(15000, -500)).toBe(0);
    expect(collectionError(15000, 15000)).toBeNull();
    expect(collectionError(0, 15000)).toBeNull();
    expect(collectionError(150000, 15000)).toBe('tooMuch');
    expect(collectionError(-1, 15000)).toBe('negative');
    expect(collectionError(10.5, 15000)).toBe('negative');
  });

  it('l’argent chez chaque livreur : encaissé moins remis', () => {
    const balances = courierBalances(
      [
        { courierId: 'koffi', amount: 15000 },
        { courierId: 'koffi', amount: 5000 },
        { courierId: 'codjo', amount: 3000 },
      ],
      [
        { courierId: 'koffi', amount: 12000 },
        { courierId: 'codjo', amount: 3000 },
      ]
    );
    expect([...balances]).toEqual([['koffi', 8000]]);
  });

  it('l’heure souhaitée : « 15:30 », « 15h30 », « 15h », « 9 »', () => {
    expect(parseTime('15:30')).toEqual({ hours: 15, minutes: 30 });
    expect(parseTime('15h30')).toEqual({ hours: 15, minutes: 30 });
    expect(parseTime(' 15h ')).toEqual({ hours: 15, minutes: 0 });
    expect(parseTime('9')).toEqual({ hours: 9, minutes: 0 });
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('15:75')).toBeNull();
    expect(parseTime('midi')).toBeNull();
    expect(requestedMoment('2026-11-02', { hours: 15, minutes: 30 })).toBe(
      new Date(2026, 10, 2, 15, 30).toISOString()
    );
  });

  it('la photo d’un reçu va dans le dossier du livreur', () => {
    expect(receiptPath('boutique', 'koffi', 'depense')).toBe('boutique/koffi/depense.jpg');
  });
});
