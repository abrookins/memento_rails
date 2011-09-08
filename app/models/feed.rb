require 'feedzirra'

class Feed < ActiveRecord::Base
  belongs_to :user

  def import_memories
    feed = Feedzirra::Feed.fetch_and_parse(@url)
  end
end
