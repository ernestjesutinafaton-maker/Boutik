/**
 * Les liens du site qui ouvrent l'appli Android (« App Links »), par exemple le lien
 * d'invitation https://boutik-services.vercel.app/app/invitation/… : sur le site, l'appli web
 * vit sous « /app » ; dans l'appli installée, les écrans sont à la racine (/invitation/…).
 * Les autres liens (boutik://…) passent tels quels. Ne jamais planter ici : en cas de doute,
 * on ouvre l'accueil.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'boutik://app');
    if (url.pathname === '/app' || url.pathname.startsWith('/app/')) {
      return (url.pathname.slice('/app'.length) || '/') + url.search;
    }
    return path;
  } catch {
    return '/';
  }
}
