from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Dictionary, User, Word
from app.schemas import (
    DictionaryCreate,
    DictionaryOut,
    DictionaryShort,
    DictionaryUpdate,
    WordCreate,
    WordOut,
    WordUpdate,
)

router = APIRouter(prefix="/dictionaries", tags=["dictionaries"])


# ---------- Helpers ----------
def _get_own_dictionary(
    db: Session, dictionary_id: int, user: User, with_words: bool = False
) -> Dictionary:
    dictionary = db.get(Dictionary, dictionary_id)
    if not dictionary:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dictionary not found")
    if dictionary.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your dictionary")
    return dictionary


# ---------- Dictionaries ----------
@router.get("", response_model=list[DictionaryOut])
def list_dictionaries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Dictionary]:
    """Все словари текущего пользователя вместе со словами."""
    return (
        db.query(Dictionary)
        .filter(Dictionary.owner_id == current_user.id)
        .order_by(Dictionary.created_at)
        .all()
    )


@router.post("", response_model=DictionaryOut, status_code=status.HTTP_201_CREATED)
def create_dictionary(
    payload: DictionaryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dictionary:
    if not payload.name.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Name cannot be empty")

    dictionary = Dictionary(
        owner_id=current_user.id,
        name=payload.name.strip(),
    )
    db.add(dictionary)
    db.commit()
    db.refresh(dictionary)
    return dictionary


@router.get("/{dictionary_id}", response_model=DictionaryOut)
def get_dictionary(
    dictionary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dictionary:
    return _get_own_dictionary(db, dictionary_id, current_user)


@router.patch("/{dictionary_id}", response_model=DictionaryOut)
def update_dictionary(
    dictionary_id: int,
    payload: DictionaryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dictionary:
    dictionary = _get_own_dictionary(db, dictionary_id, current_user)

    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        if not data["name"] or not data["name"].strip():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Name cannot be empty")
        dictionary.name = data["name"].strip()

    db.commit()
    db.refresh(dictionary)
    return dictionary


@router.delete("/{dictionary_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dictionary(
    dictionary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    dictionary = _get_own_dictionary(db, dictionary_id, current_user)
    db.delete(dictionary)
    db.commit()


# ---------- Words ----------
@router.post(
    "/{dictionary_id}/words",
    response_model=WordOut,
    status_code=status.HTTP_201_CREATED,
)
def add_word(
    dictionary_id: int,
    payload: WordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Word:
    dictionary = _get_own_dictionary(db, dictionary_id, current_user)

    if not payload.word.strip() or not payload.translation.strip():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Word and translation cannot be empty"
        )

    word = Word(
        dictionary_id=dictionary.id,
        word=payload.word.strip(),
        translation=payload.translation.strip(),
        example=payload.example.strip() if payload.example else "",
    )
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


@router.patch(
    "/{dictionary_id}/words/{word_id}",
    response_model=WordOut,
)
def update_word(
    dictionary_id: int,
    word_id: int,
    payload: WordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Word:
    dictionary = _get_own_dictionary(db, dictionary_id, current_user)
    word = db.get(Word, word_id)
    if not word or word.dictionary_id != dictionary.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Word not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if value is not None:
            setattr(word, field, value.strip() if isinstance(value, str) else value)

    db.commit()
    db.refresh(word)
    return word


@router.delete(
    "/{dictionary_id}/words/{word_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_word(
    dictionary_id: int,
    word_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    dictionary = _get_own_dictionary(db, dictionary_id, current_user)
    word = db.get(Word, word_id)
    if not word or word.dictionary_id != dictionary.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Word not found")

    db.delete(word)
    db.commit()


# ---------- Bulk import ----------
@router.post(
    "/{dictionary_id}/words/bulk",
    response_model=list[WordOut],
    status_code=status.HTTP_201_CREATED,
)
def bulk_import_words(
    dictionary_id: int,
    payload: list[WordCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Word]:
    dictionary = _get_own_dictionary(db, dictionary_id, current_user)

    created: list[Word] = []
    for item in payload:
        if not item.word.strip() or not item.translation.strip():
            continue
        word = Word(
            dictionary_id=dictionary.id,
            word=item.word.strip(),
            translation=item.translation.strip(),
            example=item.example.strip() if item.example else "",
        )
        db.add(word)
        created.append(word)

    db.commit()
    for word in created:
        db.refresh(word)
    return created