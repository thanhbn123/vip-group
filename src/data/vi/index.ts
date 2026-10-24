import type { SiteContent } from '../types';
import { company } from './company';
import { sectors } from './sectors';
import { subsidiaries } from './subsidiaries';
import { news } from './news';
import { careers } from './careers';
import { contact } from './contact';

export const content: SiteContent = { company, sectors, subsidiaries, news, careers, contact };
