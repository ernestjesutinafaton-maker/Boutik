import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput } from 'react-native-paper';

import { TextField, type TextFieldProps } from './text-field';

/** Champ de mot de passe, avec un œil pour l'afficher ou le cacher. */
export function PasswordField(props: Omit<TextFieldProps, 'secureTextEntry' | 'right'>) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  return (
    <TextField
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      secureTextEntry={!isVisible}
      right={
        <TextInput.Icon
          icon={isVisible ? 'eye-off' : 'eye'}
          onPress={() => setIsVisible((visible) => !visible)}
          accessibilityLabel={t('auth.showPassword')}
        />
      }
    />
  );
}
