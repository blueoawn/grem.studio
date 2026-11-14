import { processMedia } from './processor.mjs';
import { spacetimeReporter } from './spacetime.mjs';
import { localStorage } from './storage.mjs';

const [asset_id, storage_key, content_type] = process.argv.slice(2);
const { SITE_FEED_DATABASE, SITE_FEED_PROCESSOR_TOKEN, SITE_FEED_SERVER, SITE_FEED_STORAGE_ROOT } = process.env;

try {
  if (!asset_id || !storage_key || !content_type || !SITE_FEED_SERVER || !SITE_FEED_DATABASE || !SITE_FEED_STORAGE_ROOT) {
    throw new Error('Usage: node cli.mjs <asset-id> <storage-key> <content-type>; set SITE_FEED_SERVER, SITE_FEED_DATABASE, SITE_FEED_STORAGE_ROOT and SITE_FEED_PROCESSOR_TOKEN');
  }
  const storage = await localStorage(SITE_FEED_STORAGE_ROOT);
  const reporter = spacetimeReporter({ server: SITE_FEED_SERVER, database: SITE_FEED_DATABASE, token: SITE_FEED_PROCESSOR_TOKEN });
  const result = await processMedia({ asset_id, storage_key, content_type }, { storage, reporter });
  console.log(JSON.stringify({ asset_id, ...result }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
