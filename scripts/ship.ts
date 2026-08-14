/**
 * The publish path, as a mechanism instead of a habit.
 *
 *   pnpm ship                 # check, test, build, deploy, commit, push
 *   pnpm ship --dry           # everything except deploy, commit and push
 *   pnpm ship --message "..." # commit message for the auto-commit
 *
 * WHY THIS EXISTS. On 13 August 2026 an audit of this repo found that the quote
 * check was not a gate. It is not in `build`:
 *
 *   build:  pnpm run generate:og && astro build
 *   verify: pnpm run typecheck && pnpm run test && pnpm run test:e2e
 *
 * It is a standalone script plus .github/workflows/verify-quotes.yml, which
 * fires on push. Deploys happen by hand with `wrangler deploy` from a working
 * tree. So nothing could stop a briefing with an unverifiable quote reaching
 * the site. Worse, .github/workflows/deploy.yml triggers on pushes to `main`
 * and this repo's branch is `master`, so that workflow has never run once.
 *
 * A verbatim quote that is not verbatim is the one mistake this publication
 * cannot absorb. Protecting it was a habit, written down in CLAUDE.md and
 * carried out by whoever remembered. This makes it a step that has to pass.
 *
 * WHAT IT CHECKS AND WHAT IT DOES NOT. It checks the briefings that CHANGED,
 * because checking all eleven takes thirty-four seconds and re-fetches every
 * cited source for files nobody touched. It does not check prose claims inside
 * ::position bodies, because nothing does; only quotes carrying a source URL
 * are machine-checkable, and today that is two briefings out of eleven. Do not
 * read a green run as "the whole briefing is verified". Read it as "every quote
 * that could be checked, was".
 *
 * It still pushes at the end, so verify-quotes.yml runs the same check from
 * GitHub's network as an independent witness. This script runs from a home
 * connection, which matters: some publishers serve datacenter IPs differently,
 * and the workflow file already warns about that false-failure mode. Two
 * witnesses on different networks is the point, not belt and braces.
 */
import { execFileSync, execSync } from 'node:child_process';
import * as path from 'node:path';
import * as url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const msgIndex = argv.indexOf('--message');
const MESSAGE = msgIndex >= 0 ? argv[msgIndex + 1] : undefined;
const SKIP_E2E = argv.includes('--skip-e2e');

let step = 0;
function announce(what: string): void {
  step += 1;
  console.log(`\n\x1b[1m[${step}] ${what}\x1b[0m`);
}

function run(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
}

function capture(cmd: string): string {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function die(why: string): never {
  console.error(`\n\x1b[31mSTOPPED: ${why}\x1b[0m`);
  console.error('Nothing was deployed.\n');
  process.exit(1);
}

/**
 * Which briefings differ from what is on the remote.
 *
 * Compared against origin rather than against HEAD, deliberately. A file
 * committed locally but never pushed is still a change the published site has
 * not seen, and checking only the working tree would skip it. If the upstream
 * ref cannot be resolved, every briefing is checked: erring toward the slow,
 * complete run is the right way to be wrong here.
 */
function changedBriefings(): { slugs: string[]; comparedTo: string } {
  const prefix = 'src/content/briefings/';
  let base = '';
  try {
    base = capture('git rev-parse --abbrev-ref --symbolic-full-name @{u}');
  } catch {
    base = '';
  }
  if (!base) {
    console.log('  no upstream branch found, so every briefing will be checked');
    return { slugs: [], comparedTo: 'everything (no upstream)' };
  }
  // Four sources, all of which emit BARE PATHS, one per line.
  //
  // The first version of this parsed `git status --porcelain` by slicing off
  // the two-character status column. That column is fixed width and starts
  // with a space for an unstaged change, and capture() trims its output, so
  // the leading space was eaten and the slice cut one character too far:
  // "rc/content/briefings/...". It then matched no prefix and reported that
  // nothing had changed. Worse, trim() only affects the FIRST line, so the bug
  // would have spared every file except the first one in the list. Caught by
  // deliberately corrupting a quote and watching the gate wave it through.
  //
  // None of these four commands emit a status column, so there is nothing to
  // mis-slice.
  const sources = [
    `git diff --name-only ${base}...HEAD -- ${prefix}`,        // committed here, not on the remote
    `git diff --name-only -- ${prefix}`,                        // edited, not staged
    `git diff --name-only --cached -- ${prefix}`,               // staged, not committed
    `git ls-files --others --exclude-standard -- ${prefix}`,    // a brand new briefing
  ];
  const lines: string[] = [];
  for (const cmd of sources) {
    try {
      lines.push(...capture(cmd).split('\n'));
    } catch {
      // One failing source must not hide the others, but it must not be
      // silent either: a partial answer here means an unchecked briefing.
      console.log(`  warning: "${cmd}" failed, so this check may be incomplete`);
    }
  }
  const slugs = [...new Set(
    lines
      .map((l) => l.trim())
      .filter((l) => l.startsWith(prefix) && l.endsWith('.md'))
      .map((l) => path.basename(l, '.md')),
  )];
  return { slugs, comparedTo: base };
}

console.log('\n\x1b[1mThe Whetstone: ship\x1b[0m');
console.log(DRY ? 'Dry run. Nothing will be deployed or pushed.' : 'This will deploy and push.');

// ---- 1. quotes, on what changed -------------------------------------------
announce('Quote provenance');
const { slugs, comparedTo } = changedBriefings();
if (slugs.length === 0 && comparedTo.startsWith('everything')) {
  console.log('  checking every briefing');
  try { run('pnpm', ['tsx', 'scripts/verify-quotes.ts']); }
  catch { die('a quote could not be verified at its source'); }
} else if (slugs.length === 0) {
  console.log(`  no briefing changed against ${comparedTo}, so there is nothing to check`);
} else {
  console.log(`  changed against ${comparedTo}: ${slugs.join(', ')}`);
  try { run('pnpm', ['tsx', 'scripts/verify-quotes.ts', ...slugs]); }
  catch { die('a quote could not be verified at its source'); }
}

// ---- 2. types --------------------------------------------------------------
announce('Typecheck');
try { run('pnpm', ['run', 'typecheck']); } catch { die('typecheck failed'); }

// ---- 3. tests --------------------------------------------------------------
announce('Unit tests');
try { run('pnpm', ['run', 'test']); } catch { die('tests failed'); }

if (!SKIP_E2E) {
  announce('End-to-end tests');
  try { run('pnpm', ['run', 'test:e2e']); }
  catch { die('end-to-end tests failed (pass --skip-e2e only if you know why)'); }
}

// ---- 4. build --------------------------------------------------------------
announce('Build');
try { run('pnpm', ['run', 'build']); } catch { die('the build failed'); }

if (DRY) {
  console.log('\n\x1b[32mAll checks passed.\x1b[0m Dry run, so nothing was deployed.\n');
  process.exit(0);
}

// ---- 5. deploy -------------------------------------------------------------
announce('Deploy');
try { run('pnpm', ['wrangler', 'deploy']); } catch { die('the deploy failed'); }

// ---- 6. commit and push ----------------------------------------------------
// Last, not first. A push that happens before the checks would put unverified
// work on the remote, and the point of the order is that nothing leaves this
// machine until it has passed.
announce('Commit and push');
const branch = capture('git rev-parse --abbrev-ref HEAD');
let dirty = '';
try { dirty = capture('git status --porcelain'); } catch { dirty = ''; }

if (dirty) {
  const message = MESSAGE ?? `Ship: ${slugs.length ? slugs.join(', ') : 'site update'}`;
  run('git', ['add', '-A']);
  run('git', ['commit', '-m', message]);
  console.log(`  committed on ${branch}`);
} else {
  console.log('  working tree clean, nothing to commit');
}

try {
  run('git', ['push', 'origin', branch]);
} catch {
  console.error('\n\x1b[33mDeployed, but the push failed.\x1b[0m');
  console.error('The site is live. Push by hand so verify-quotes.yml runs as a second witness.\n');
  process.exit(1);
}

console.log('\n\x1b[32mShipped.\x1b[0m');
console.log(`  quotes checked: ${slugs.length ? slugs.join(', ') : 'nothing changed'}`);
console.log(`  branch: ${branch}`);
console.log('  verify-quotes.yml will now run the same check from GitHub as a second witness.\n');
