import { StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';

import { TextField } from '@/components/text-field';
import { type CatalogUnit, sortUnits } from '@/domain/catalog';
import { useAppTheme } from '@/theme/paper-theme';

type UnitQuantityFieldProps = {
  units: readonly CatalogUnit[];
  unitId: string;
  onUnitChange: (unit: CatalogUnit) => void;
  quantity: string;
  onQuantityChange: (text: string) => void;
  label: string;
  errorMessage?: string | null;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
};

/** Choix de l'unité (sac, kilo, carton…) puis quantité tapée dans cette unité. */
export function UnitQuantityField(props: UnitQuantityFieldProps) {
  const theme = useAppTheme();
  const units = sortUnits(props.units);

  return (
    <View style={{ gap: theme.app.spacing.sm }}>
      {units.length > 1 ? (
        <View style={[styles.wrap, { gap: theme.app.spacing.sm }]}>
          {units.map((unit) => (
            <Chip
              key={unit.id}
              selected={unit.id === props.unitId}
              onPress={() => props.onUnitChange(unit)}>
              {unit.name}
            </Chip>
          ))}
        </View>
      ) : null}
      <TextField
        label={props.label}
        value={props.quantity}
        onChangeText={props.onQuantityChange}
        keyboardType="numeric"
        autoFocus={props.autoFocus}
        onSubmitEditing={props.onSubmitEditing}
        errorMessage={props.errorMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
