import Fuse from 'fuse.js';
import DosenRepository from './dosen.repository';
import redisService from '../../infrastructures/redis.infrastructure';
import { APIError } from '../../utils/api-error.util';
import { normalizeCachePart } from '../../utils/cache-key.util';

export default class DosenService {
  public static async search(query: string) {
    const normalizedQuery = normalizeCachePart(query);
    return redisService.remember(
      `dosen:search:${normalizedQuery}`,
      300,
      async () => {
        const allDosen = await DosenRepository.findAll();

        if (!allDosen || allDosen.length === 0) {
          throw new APIError(`Tidak ada data dosen`, 404);
        }

        const fuseOptions = {
          keys: [
            { name: 'nama', weight: 0.7 },
            { name: 'nip', weight: 0.3 },
          ],
          threshold: 0.4,
          distance: 100,
          minMatchCharLength: 2,
          includeScore: true,
          includeMatches: true,
          ignoreLocation: true,
          findAllMatches: true,
        };

        const fuse = new Fuse(allDosen, fuseOptions);
        const results = fuse.search(query);

        if (results.length === 0) {
          throw new APIError(`Dosen tidak ditemukan`, 404);
        }

        const formattedResults = results.map((result) => {
          const dosen = result.item;
          const matches = result.matches || [];

          const highlights: any = {};

          matches.forEach((match) => {
            if (match.key && match.indices) {
              const fieldValue = match.value || '';
              const highlightedText = DosenService.highlightMatches(
                fieldValue,
                match.indices
              );
              highlights[match.key] = highlightedText;
            }
          });

          return {
            ...dosen,
            _highlights: highlights,
            _score: result.score,
          };
        });

        return {
          response: true,
          message: `Ditemukan ${formattedResults.length} dosen! 🔍`,
          data: formattedResults,
          query: query,
        };
      }
    );
  }

  private static highlightMatches(
    text: string,
    indices: readonly [number, number][]
  ): string {
    let highlightedText = '';
    let lastIndex = 0;
    indices.forEach(([start, end]) => {
      highlightedText += text.substring(lastIndex, start);
      highlightedText += `<mark>${text.substring(start, end + 1)}</mark>`;
      lastIndex = end + 1;
    });
    highlightedText += text.substring(lastIndex);
    return highlightedText;
  }
  public static async getAll() {
    return redisService.remember('dosen:all', 1_800, async () => {
      const dosen = await DosenRepository.findAll();
      if (!dosen || dosen.length === 0) {
        throw new APIError('Data Dosen tidak ditemukan', 404);
      }
      return {
        response: true,
        message: 'Data semua dosen berhasil diambil',
        data: dosen,
      };
    });
  }
}
