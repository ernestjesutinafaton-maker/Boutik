import { View } from 'react-native';
import { HelperText, TextInput, type TextInputProps } from 'react-native-paper';

import { useAppTheme } from '@/theme/paper-theme';

export type TextFieldProps = Omit<TextInputProps, 'mode' | 'error'> & {
  /** Message d'erreur affiché en rouge sous le champ (rien si null) */
  errorMessage?: string | null;
};

/** Champ de saisie avec un texte bien lisible et un message d'erreur clair. */
export function TextField({ errorMessage, style, ...rest }: TextFieldProps) {
  const theme = useAppTheme();

  return (
    <View>
      <TextInput
        mode="outlined"
        error={Boolean(errorMessage)}
        outlineStyle={{ borderRadius: theme.app.radius.md }}
        style={[
          { fontSize: theme.app.fontSize.large, backgroundColor: theme.colors.surface },
          style,
        ]}
        {...rest}
      />
      {errorMessage ? (
        <HelperText type="error" visible>
          {errorMessage}
        </HelperText>
      ) : null}
    </View>
  );
}
