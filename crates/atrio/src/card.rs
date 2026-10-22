//! Regras do card que os dois núcleos aplicam (vieram do Ideario): o status de três cores e o lembrete que se
//! repete. São as mesmas de `src/card/meta.ts` (a interface) — mudou uma, muda a outra, com o mesmo teste.
//!
//! O app lê os campos do card num [`CardStatus`], chama a regra e grava o que mudou. O que é só de um app (adiar e
//! avisar no Ideario, o histórico de desfazer no Nodo) fica nele.

use chrono::{Days, Months, NaiveDateTime, TimeZone};
use serde::{Deserialize, Serialize};

/// Status do card, o seletor de três cores: vermelho (a fazer), amarelo (em andamento), verde (concluído).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    Todo,
    Doing,
    Done,
}

impl Status {
    pub fn parse(s: &str) -> Option<Status> {
        match s {
            "todo" => Some(Status::Todo),
            "doing" => Some(Status::Doing),
            "done" => Some(Status::Done),
            _ => None,
        }
    }

    pub fn of(done: bool, doing: bool) -> Status {
        match (done, doing) {
            (true, _) => Status::Done,
            (false, true) => Status::Doing,
            (false, false) => Status::Todo,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Status::Todo => "todo",
            Status::Doing => "doing",
            Status::Done => "done",
        }
    }
}

/// Os campos do card que o status e o lembrete usam (camelCase, como na interface).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CardStatus {
    /// Hora do lembrete, em milissegundos Unix.
    pub reminder_at: Option<i64>,
    /// `day`, `week`, `month` ou `year` ([`crate::text::REPEATS`]).
    pub reminder_repeat: Option<String>,
    pub reminder_done: bool,
    pub reminder_doing: bool,
    /// Status posto à mão (pelo menu ou pelo seletor), sem lembrete.
    pub status_on: bool,
}

impl CardStatus {
    /// Tem status: tem lembrete ou o status foi posto à mão.
    pub fn has_status(&self) -> bool {
        self.reminder_at.is_some() || self.status_on
    }

    /// O status, se o card tem.
    pub fn status(&self) -> Option<Status> {
        self.has_status()
            .then(|| Status::of(self.reminder_done, self.reminder_doing))
    }

    /// Muda o status. Com lembrete, verde é [`Self::complete`] (o que se repete pula para a próxima vez e volta ao
    /// vermelho). Sem lembrete, o card passa a ter status (`status_on`).
    pub fn set_status<Tz: TimeZone>(&mut self, to: Status, now: i64, tz: &Tz) {
        if self.reminder_at.is_some() && to == Status::Done {
            self.complete(now, tz);
            return;
        }
        self.reminder_done = to == Status::Done;
        self.reminder_doing = to == Status::Doing;
        if self.reminder_at.is_none() {
            self.status_on = true;
        }
    }

    /// Concluir: o lembrete de uma vez fica concluído; o que se repete pula para a próxima vez, a partir de agora (a
    /// série continua), e começa do zero (vermelho). Sem lembrete, só marca concluído.
    pub fn complete<Tz: TimeZone>(&mut self, now: i64, tz: &Tz) {
        match (self.reminder_at, self.reminder_repeat.as_deref()) {
            (Some(at), Some(repeat)) => {
                if let Some(next) = next_occurrence(at, repeat, now.max(at), tz) {
                    self.reminder_at = Some(next);
                    self.reminder_doing = false;
                    self.reminder_done = false;
                }
            }
            _ => {
                self.reminder_done = true;
                self.reminder_doing = false;
            }
        }
    }

    /// Tira o status posto à mão. Card com lembrete continua com status (ele vem do lembrete).
    pub fn clear_status(&mut self) {
        self.status_on = false;
        if self.reminder_at.is_none() {
            self.reminder_done = false;
            self.reminder_doing = false;
        }
    }
}

/// Próxima vez de um lembrete que se repete, depois de `now`, no mesmo horário local. Mês e ano contam a partir da
/// data original (31/jan, todo mês → 28 ou 29/fev → 31/mar), sem escorregar. Repetição desconhecida: `None`.
pub fn next_occurrence<Tz: TimeZone>(at: i64, repeat: &str, now: i64, tz: &Tz) -> Option<i64> {
    let anchor = tz.timestamp_millis_opt(at).single()?.naive_local();
    let step = |k: u32| -> Option<NaiveDateTime> {
        match repeat {
            "day" => anchor.checked_add_days(Days::new(u64::from(k))),
            "week" => anchor.checked_add_days(Days::new(7 * u64::from(k))),
            "month" => anchor.checked_add_months(Months::new(k)),
            "year" => anchor.checked_add_months(Months::new(12 * k)),
            _ => None,
        }
    };
    // Começa perto de `now` (um lembrete diário de anos atrás não precisa de milhares de voltas).
    let elapsed_days = u32::try_from((now - at).max(0) / 86_400_000).unwrap_or(u32::MAX);
    let mut k = match repeat {
        "day" => elapsed_days.saturating_sub(1).max(1),
        "week" => (elapsed_days / 7).saturating_sub(1).max(1),
        "month" => (elapsed_days / 31).saturating_sub(1).max(1),
        _ => (elapsed_days / 366).saturating_sub(1).max(1),
    };
    loop {
        let local = step(k)?;
        // Horário que não existe (início do horário de verão): uma hora depois.
        let when = tz.from_local_datetime(&local).earliest().or_else(|| {
            tz.from_local_datetime(&(local + chrono::Duration::hours(1)))
                .earliest()
        })?;
        let ms = when.timestamp_millis();
        if ms > now {
            return Some(ms);
        }
        k = k.checked_add(1)?;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{FixedOffset, Utc};

    const DAY: i64 = 86_400_000;

    fn ms(y: i32, m: u32, d: u32, h: u32) -> i64 {
        Utc.with_ymd_and_hms(y, m, d, h, 0, 0)
            .unwrap()
            .timestamp_millis()
    }

    #[test]
    fn done_on_a_repeating_reminder_goes_to_the_next_time_and_back_to_todo() {
        let at = ms(2026, 10, 20, 9);
        let mut c = CardStatus {
            reminder_at: Some(at),
            reminder_repeat: Some("day".into()),
            reminder_doing: true,
            ..Default::default()
        };
        c.set_status(Status::Done, at + DAY / 2, &Utc);
        assert_eq!(
            c.reminder_at,
            Some(at + DAY),
            "pula para amanhã no mesmo horário"
        );
        assert_eq!(
            c.status(),
            Some(Status::Todo),
            "a próxima vez começa do zero"
        );
    }

    #[test]
    fn done_on_a_one_time_reminder_or_without_reminder_stays_done() {
        let mut once = CardStatus {
            reminder_at: Some(ms(2026, 10, 20, 9)),
            ..Default::default()
        };
        once.set_status(Status::Done, ms(2026, 10, 21, 9), &Utc);
        assert_eq!(once.status(), Some(Status::Done));
        assert_eq!(once.reminder_at, Some(ms(2026, 10, 20, 9)));
        let mut plain = CardStatus::default();
        assert_eq!(plain.status(), None);
        plain.set_status(Status::Doing, 0, &Utc);
        assert!(plain.status_on);
        assert_eq!(plain.status(), Some(Status::Doing));
        plain.clear_status();
        assert_eq!(plain, CardStatus::default());
    }

    #[test]
    fn clearing_keeps_the_status_that_comes_from_a_reminder() {
        let mut c = CardStatus {
            reminder_at: Some(1),
            reminder_doing: true,
            status_on: true,
            ..Default::default()
        };
        c.clear_status();
        assert_eq!(c.status(), Some(Status::Doing));
        assert!(!c.status_on);
    }

    #[test]
    fn monthly_from_the_31st_does_not_slip() {
        let at = ms(2026, 1, 31, 9);
        let feb = next_occurrence(at, "month", at, &Utc).unwrap();
        assert_eq!(feb, ms(2026, 2, 28, 9));
        let mar = next_occurrence(at, "month", feb, &Utc).unwrap();
        assert_eq!(mar, ms(2026, 3, 31, 9), "conta da data original");
        assert_eq!(next_occurrence(at, "nunca", at, &Utc), None);
    }

    #[test]
    fn local_time_is_kept() {
        let br = FixedOffset::west_opt(3 * 3600).unwrap();
        let at = br
            .with_ymd_and_hms(2026, 10, 20, 8, 0, 0)
            .unwrap()
            .timestamp_millis();
        let next = next_occurrence(at, "week", at + 1, &br).unwrap();
        assert_eq!(next - at, 7 * DAY);
        let years = next_occurrence(at, "day", at + 3 * 365 * DAY, &br).unwrap();
        assert!(years > at + 3 * 365 * DAY && years - (at + 3 * 365 * DAY) <= DAY);
    }
}
