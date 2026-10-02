import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { GUIDE_TOPICS, GuideText, GuideTopic } from './guide-content';

@Component({
  selector: 'app-guide-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './guide-page.component.html',
  styleUrl: './guide-page.component.scss',
})
export class GuidePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LocalizationService);
  protected readonly selectedId = signal('start');
  protected readonly query = signal('');
  protected readonly group = signal<'all' | GuideTopic['group']>('all');

  protected readonly groups = [
    { id: 'all', label: { en: 'All topics', ar: 'كل المواضيع' } },
    { id: 'start', label: { en: 'Get started', ar: 'ابدأ' } },
    { id: 'reception', label: { en: 'Reception', ar: 'الاستقبال' } },
    { id: 'clinical', label: { en: 'Clinical', ar: 'الطبيب' } },
    { id: 'management', label: { en: 'Management', ar: 'الإدارة' } },
  ] as const;

  protected readonly availableTopics = computed(() => GUIDE_TOPICS.filter(
    topic => !topic.permission || this.auth.hasPermission(topic.permission),
  ));

  protected readonly filteredTopics = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.availableTopics().filter(topic =>
      (this.group() === 'all' || topic.group === this.group()) &&
      (!query || [topic.title.en, topic.title.ar, topic.summary.en, topic.summary.ar,
        ...topic.steps.flatMap(step => [step.title.en, step.title.ar, step.detail.en, step.detail.ar])]
        .some(value => value.toLocaleLowerCase().includes(query))),
    );
  });

  protected readonly selectedTopic = computed(() =>
    this.filteredTopics().find(topic => topic.id === this.selectedId()) ?? this.filteredTopics()[0],
  );

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const topic = params.get('topic');
      if (topic && GUIDE_TOPICS.some(item => item.id === topic)) this.selectedId.set(topic);
    });
  }

  ngOnInit(): void {
    const topic = this.route.snapshot.queryParamMap.get('topic');
    if (topic && this.availableTopics().some(item => item.id === topic)) this.selectedId.set(topic);
  }

  protected choose(topic: GuideTopic): void { this.selectedId.set(topic.id); }
  protected canOpen(permission?: string): boolean { return !permission || this.auth.hasPermission(permission); }
  protected text(value: GuideText): string { return value[this.i18n.language()]; }
  protected t(en: string, ar: string): string { return this.i18n.language() === 'ar' ? ar : en; }
}
