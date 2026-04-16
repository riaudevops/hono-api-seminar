import { green, yellow, red, cyan, magenta } from 'colorette';

export default class LogHelper {
  public static formatDate(date: Date): String {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(date.getDate());
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `[${day}.${month}.${year} - ${hours}.${minutes}.${seconds} WIB]`;
  }

  public static colorStatus(status: number) {
    if (status >= 500) return red(String(status));
    if (status >= 400) return yellow(String(status));
    if (status >= 300) return cyan(String(status));
    return green(String(status));
  }

  public static colorMethod(method: string) {
    if (method === 'GET') return green(method);
    if (method === 'POST') return yellow(method);
    if (method === 'PUT') return cyan(method);
    if (method === 'DELETE') return red(method);
    return magenta(method);
  }

  public static colorDuration(duration: number) {
    if (duration >= 400) return red(String(duration) + 'ms');
    if (duration >= 200) return yellow(String(duration) + 'ms');
    return green(String(duration) + 'ms');
  }
}
