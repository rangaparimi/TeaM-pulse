"""Small ORM-to-schema conversions that need a joined field (like
mentor_name) that isn't a plain column on the model.
"""

from app import models, schemas


def intern_out(intern: models.Intern) -> schemas.InternOut:
    return schemas.InternOut(
        id=intern.id,
        user_id=intern.user_id,
        name=intern.name,
        team_name=intern.mentor.team_name if intern.mentor else None,
        mentor_id=intern.mentor_id,
        mentor_name=intern.mentor.name if intern.mentor else None,
        github_username=intern.github_username,
        repo=intern.repo,
        start_date=intern.start_date,
    )
